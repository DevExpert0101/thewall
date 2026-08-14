-- Wall Key is issued before payment. The database stores only the hash.
-- The paying wallet is never the ownership credential.

alter table public.payment_intents
  add column if not exists claim_secret_hash text;

alter table public.payment_intents
  drop constraint if exists payment_intents_claim_hash_sha256;

alter table public.payment_intents
  add constraint payment_intents_claim_hash_sha256
  check (claim_secret_hash is null or claim_secret_hash ~ '^[0-9a-f]{64}$');

comment on column public.payment_intents.claim_secret_hash is
  'SHA-256 of the Wall Key issued at checkout. Raw keys are never stored.';

create table if not exists public.message_claims (
  payment_intent_id uuid primary key references public.payment_intents (id),
  claim_secret_hash text not null,
  message_id uuid references public.messages (id),
  created_at timestamptz not null default now(),
  constraint message_claims_hash_sha256 check (claim_secret_hash ~ '^[0-9a-f]{64}$')
);

create unique index if not exists message_claims_hash_idx
  on public.message_claims (claim_secret_hash);

create unique index if not exists message_claims_message_idx
  on public.message_claims (message_id)
  where message_id is not null;

comment on table public.message_claims is
  'Anonymous ownership tickets. Hash of the Wall Key, never the key, never a wallet.';

create table if not exists public.prize_nominations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id),
  payout_method text not null,
  payout_address text not null,
  created_at timestamptz not null default now(),
  constraint prize_nominations_method check (payout_method in ('usdc')),
  constraint prize_nominations_address check (payout_address ~ '^0x[0-9a-f]{40}$'),
  constraint prize_nominations_one_per_message unique (message_id)
);

comment on table public.prize_nominations is
  'Winner payout instructions collected only after a Wall Key claim. Not public.';

alter table public.message_claims enable row level security;
alter table public.prize_nominations enable row level security;
alter table public.message_claims force row level security;
alter table public.prize_nominations force row level security;

revoke all on public.message_claims from public, anon, authenticated;
revoke all on public.prize_nominations from public, anon, authenticated;
grant all on public.message_claims to service_role;
grant all on public.prize_nominations to service_role;

create or replace function public.freeze_payment_intent_terms()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.message_text is distinct from old.message_text
     or new.message_hash is distinct from old.message_hash
     or new.amount is distinct from old.amount
     or new.recipient_wallet is distinct from old.recipient_wallet
     or new.currency is distinct from old.currency
     or new.network is distinct from old.network
     or new.event_id is distinct from old.event_id
     or new.anonymous_user_id is distinct from old.anonymous_user_id
     or new.claim_secret_hash is distinct from old.claim_secret_hash
  then
    raise exception 'intent_terms_frozen';
  end if;
  return new;
end;
$$;

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

  if v_intent.claim_secret_hash is not null
     and v_intent.claim_secret_hash is distinct from v_token then
    raise exception 'hash_mismatch';
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

  insert into public.message_claims (payment_intent_id, claim_secret_hash, message_id)
  values (p_intent_id, v_token, v_message_id);

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
