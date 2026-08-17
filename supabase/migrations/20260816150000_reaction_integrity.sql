-- Reaction integrity: idempotent 🔥, uniqueness, RLS-denied signals.
-- Direct table writes stay closed. Only service_role may execute the RPC.

alter table public.reactions
  add column if not exists idempotency_key uuid;

create unique index if not exists reactions_user_idempotency_uidx
  on public.reactions (anonymous_user_id, idempotency_key)
  where idempotency_key is not null;

comment on column public.reactions.idempotency_key is
  'Client replay key. Same user + key returns the existing count and does not increment.';

create table if not exists public.reaction_signals (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  subject text not null,
  count integer not null default 1,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint reaction_signals_kind check (
    kind in ('ip_burst', 'session_farm', 'message_spike', 'challenge', 'scripted_client')
  ),
  constraint reaction_signals_subject_len check (char_length(subject) between 3 and 80),
  constraint reaction_signals_subject_safe check (
    subject !~ '[0-9]{1,3}(\\.[0-9]{1,3}){3}'
    and subject !~* 'wall[_-]?key'
  ),
  constraint reaction_signals_count_pos check (count >= 1)
);

create index if not exists reaction_signals_created_idx
  on public.reaction_signals (created_at desc);

comment on table public.reaction_signals is
  'Suspicious 🔥 patterns for operators. Hashed subjects only. Never raw IPs or Wall Keys.';

alter table public.reaction_signals enable row level security;
alter table public.reaction_signals force row level security;

revoke all on public.reaction_signals from public, anon, authenticated;
grant all on public.reaction_signals to service_role;

drop function if exists public.add_fire_reaction(uuid, uuid);

create function public.add_fire_reaction(
  p_message_id uuid,
  p_user_id uuid,
  p_idempotency_key uuid default null
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

  if p_idempotency_key is not null then
    if exists (
      select 1
      from public.reactions
      where anonymous_user_id = p_user_id
        and idempotency_key = p_idempotency_key
        and message_id = p_message_id
    ) then
      return jsonb_build_object(
        'reaction_count', v_message.reaction_count,
        'replayed', true
      );
    end if;

    if exists (
      select 1
      from public.reactions
      where anonymous_user_id = p_user_id
        and idempotency_key = p_idempotency_key
    ) then
      raise exception 'idempotency_conflict';
    end if;
  end if;

  begin
    insert into public.reactions (event_id, message_id, anonymous_user_id, idempotency_key)
    values (v_message.event_id, p_message_id, p_user_id, p_idempotency_key);
  exception
    when unique_violation then
      select reaction_count into v_count
      from public.messages
      where id = p_message_id;

      if p_idempotency_key is not null and exists (
        select 1
        from public.reactions
        where anonymous_user_id = p_user_id
          and idempotency_key = p_idempotency_key
          and message_id = p_message_id
      ) then
        return jsonb_build_object('reaction_count', coalesce(v_count, v_message.reaction_count), 'replayed', true);
      end if;

      if p_idempotency_key is not null and exists (
        select 1
        from public.reactions
        where anonymous_user_id = p_user_id
          and idempotency_key = p_idempotency_key
          and message_id <> p_message_id
      ) then
        raise exception 'idempotency_conflict';
      end if;

      raise exception 'duplicate_reaction';
  end;

  update public.messages
    set reaction_count = reaction_count + 1
    where id = p_message_id
    returning reaction_count into v_count;

  update public.event_counters
    set total_reactions = total_reactions + 1
    where event_id = v_message.event_id;

  return jsonb_build_object('reaction_count', v_count, 'replayed', false);
end;
$$;

revoke all on function public.add_fire_reaction(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.add_fire_reaction(uuid, uuid, uuid)
  to service_role;
