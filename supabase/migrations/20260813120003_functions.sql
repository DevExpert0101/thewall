-- Public-safe view: redacts removed text and never selects wallets, hashes,
-- intents, tokens, or moderation internals. Owner security is required because
-- RLS on messages denies direct SELECT to anon/authenticated.
create or replace view public.public_messages
with (security_invoker = false) as
select
  m.id,
  m.event_id,
  m.public_number,
  case
    when m.removed_at is not null then 'Message removed under archive policy.'
    else m.text
  end as text,
  (m.removed_at is not null) as is_removed,
  m.reaction_count,
  m.published_at,
  m.final_rank
from public.messages m;

comment on view public.public_messages is
  'Public monument feed. Removed messages are redacted. No wallets, tokens, or hashes.';

-- Keep counters in lockstep with event creation.
create or replace function public.ensure_event_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.event_counters (event_id)
  values (new.id)
  on conflict (event_id) do nothing;
  return new;
end;
$$;

create trigger events_ensure_counter
after insert on public.events
for each row
execute procedure public.ensure_event_counter();

-- Event phase uses database time, never client clocks.
create or replace function public.event_phase(p_event public.events)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_event.archived_at is not null and now() >= p_event.archived_at then 'archived'
    when p_event.finalized_at is not null and now() >= p_event.ends_at then 'archived'
    when now() < p_event.starts_at then 'upcoming'
    when now() < p_event.ends_at then 'live'
    else 'finalizing'
  end;
$$;

create or replace function public.assert_event_live(p_event_id uuid)
returns public.events
language plpgsql
set search_path = public
as $$
declare
  v_event public.events;
  v_phase text;
begin
  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'event_not_found';
  end if;
  v_phase := public.event_phase(v_event);
  if v_phase = 'upcoming' then
    raise exception 'event_upcoming';
  end if;
  if v_phase <> 'live' then
    raise exception 'event_ended';
  end if;
  return v_event;
end;
$$;

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid_rate_limit';
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start)
  do update set count = rl.count + 1
  returning rl.count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Atomic publication.
-- Concurrency:
--   1. FOR UPDATE on the payment_intent row serializes replays of the same intent.
--   2. FOR UPDATE on the event row serializes publish vs finalize.
--   3. FOR UPDATE on event_counters then increment assigns distinct sequential
--      numbers under concurrent publishers. UNIQUE (event_id, public_number)
--      is the last line of defense.
--   4. UNIQUE payments.transaction_hash and UNIQUE payments.payment_intent_id
--      reject double-spend / double-fulfill; unique_violation is mapped to
--      stable error names. An exception aborts the whole RPC transaction, so
--      the counter increment rolls back if a later insert fails.
create or replace function public.publish_paid_message(
  p_intent_id uuid,
  p_tx_hash text,
  p_sender text,
  p_recipient text,
  p_amount numeric,
  p_currency text,
  p_network text,
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.payment_intents;
  v_event public.events;
  v_number integer;
  v_message_id uuid;
  v_text text;
  v_tx text;
  v_sender text;
  v_recipient text;
  v_token text;
begin
  v_tx := lower(trim(p_tx_hash));
  v_sender := lower(trim(p_sender));
  v_recipient := lower(trim(p_recipient));
  v_token := lower(trim(p_token_hash));

  if v_tx !~ '^0x[0-9a-f]{64}$' then
    raise exception 'invalid_tx_hash';
  end if;
  if v_sender !~ '^0x[0-9a-f]{40}$' then
    raise exception 'invalid_sender';
  end if;
  if v_recipient !~ '^0x[0-9a-f]{40}$' then
    raise exception 'invalid_recipient';
  end if;
  if v_token !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_token_hash';
  end if;

  select * into v_intent
  from public.payment_intents
  where id = p_intent_id
  for update;

  if not found then
    raise exception 'intent_not_found';
  end if;

  if v_intent.status = 'fulfilled' then
    raise exception 'intent_already_fulfilled';
  end if;

  if v_intent.expires_at < now() then
    update public.payment_intents
      set status = 'expired'
      where id = p_intent_id and status = 'created';
    raise exception 'intent_expired';
  end if;

  if v_intent.status <> 'created' then
    raise exception 'intent_not_active';
  end if;

  if lower(v_intent.recipient_wallet) <> v_recipient then
    raise exception 'wrong_recipient';
  end if;

  if p_amount is distinct from v_intent.amount then
    raise exception 'wrong_amount';
  end if;

  if p_currency is distinct from v_intent.currency
     or p_network is distinct from v_intent.network then
    raise exception 'wrong_network';
  end if;

  -- Serialize with finalize_event_rankings and other publishers of this event.
  select * into v_event
  from public.events
  where id = v_intent.event_id
  for update;

  if not found then
    raise exception 'event_not_found';
  end if;

  perform public.assert_event_live(v_event.id);

  begin
    insert into public.payments (
      payment_intent_id,
      transaction_hash,
      sender_wallet,
      recipient_wallet,
      amount,
      currency,
      network,
      status,
      verified_at
    ) values (
      p_intent_id,
      v_tx,
      v_sender,
      v_recipient,
      p_amount,
      p_currency,
      p_network,
      'completed',
      now()
    );
  exception
    when unique_violation then
      if exists (
        select 1 from public.payments where transaction_hash = v_tx
      ) then
        raise exception 'tx_already_used';
      end if;
      raise exception 'intent_already_fulfilled';
  end;

  select next_message_number
    into v_number
    from public.event_counters
    where event_id = v_intent.event_id
    for update;

  if v_number is null then
    raise exception 'counter_missing';
  end if;

  update public.event_counters
    set
      next_message_number = next_message_number + 1,
      total_messages = total_messages + 1
    where event_id = v_intent.event_id;

  v_text := v_intent.message_text;

  insert into public.messages (
    event_id,
    public_number,
    payment_intent_id,
    text,
    text_hash,
    moderation_status,
    published_at
  ) values (
    v_intent.event_id,
    v_number,
    p_intent_id,
    v_text,
    v_intent.message_hash,
    'approved',
    now()
  )
  returning id into v_message_id;

  insert into public.message_ownership (message_id, token_hash)
  values (v_message_id, v_token);

  update public.payment_intents
    set status = 'fulfilled', fulfilled_at = now()
    where id = p_intent_id;

  insert into public.public_message_events (
    event_id, public_number, text, reaction_count, published_at
  ) values (
    v_intent.event_id, v_number, v_text, 0, now()
  );

  return jsonb_build_object(
    'message_id', v_message_id,
    'public_number', v_number,
    'published_at', now()
  );
end;
$$;

create or replace function public.add_fire_reaction(
  p_message_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message public.messages;
  v_count integer;
begin
  select * into v_message
  from public.messages
  where id = p_message_id
  for update;

  if not found then
    raise exception 'message_not_found';
  end if;

  if v_message.removed_at is not null then
    raise exception 'message_not_found';
  end if;

  perform public.assert_event_live(v_message.event_id);

  begin
    insert into public.reactions (event_id, message_id, anonymous_user_id)
    values (v_message.event_id, p_message_id, p_user_id);
  exception
    when unique_violation then
      raise exception 'duplicate_reaction';
  end;

  update public.messages
    set reaction_count = reaction_count + 1
    where id = p_message_id
    returning reaction_count into v_count;

  update public.event_counters
    set total_reactions = total_reactions + 1
    where event_id = v_message.event_id;

  return jsonb_build_object('reaction_count', v_count);
end;
$$;

-- Lazy rankings after ends_at. Writes are already closed by assert_event_live;
-- no cron is required to stop publishing.
create or replace function public.finalize_event_rankings(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    raise exception 'event_not_found';
  end if;
  if now() < v_event.ends_at then
    raise exception 'event_still_live';
  end if;
  if v_event.finalized_at is not null then
    return;
  end if;

  with ranked as (
    select
      id,
      row_number() over (
        order by reaction_count desc, published_at asc, public_number asc
      ) as rnk
    from public.messages
    where event_id = p_event_id
  )
  update public.messages m
    set final_rank = ranked.rnk
    from ranked
    where m.id = ranked.id;

  update public.events
    set finalized_at = now(),
        archived_at = coalesce(archived_at, now())
    where id = p_event_id;
end;
$$;
