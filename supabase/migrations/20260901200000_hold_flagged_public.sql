-- Flagged / pending sentences stay off the public wall until an operator acts.
-- restore already sets moderation_status = approved.

create or replace view public.public_messages
with (security_invoker = false) as
select
  m.id,
  m.event_id,
  m.public_number,
  case
    when m.removed_at is not null then 'Message removed under archive policy.'
    when m.moderation_status in ('flagged', 'pending') then 'This sentence is under review.'
    else m.text
  end as text,
  (m.removed_at is not null) as is_removed,
  m.reaction_count,
  m.published_at,
  m.final_rank
from public.messages m
where m.moderation_status not in ('flagged', 'pending');

comment on view public.public_messages is
  'Public monument feed. Removed messages are redacted. Flagged sentences are held until review. No wallets, tokens, or hashes.';

create or replace function public.add_fire_reaction(
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
  v_event_id uuid;
  v_removed timestamptz;
  v_status text;
  v_count integer;
begin
  select event_id, removed_at, moderation_status, reaction_count
    into v_event_id, v_removed, v_status, v_count
    from public.messages
    where id = p_message_id;

  if not found then
    raise exception 'message_not_found';
  end if;

  if v_removed is not null or v_status in ('flagged', 'pending') then
    raise exception 'message_not_found';
  end if;

  perform public.assert_event_live(v_event_id);

  if p_idempotency_key is not null then
    if exists (
      select 1
      from public.reactions
      where anonymous_user_id = p_user_id
        and idempotency_key = p_idempotency_key
        and message_id = p_message_id
    ) then
      return jsonb_build_object(
        'reaction_count', v_count,
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
    values (v_event_id, p_message_id, p_user_id, p_idempotency_key);
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
        return jsonb_build_object(
          'reaction_count', coalesce(v_count, 0),
          'replayed', true
        );
      end if;

      raise exception 'duplicate_reaction';
  end;

  select removed_at, moderation_status, reaction_count
    into v_removed, v_status, v_count
    from public.messages
    where id = p_message_id;

  if v_removed is not null or v_status in ('flagged', 'pending') or v_count is null then
    delete from public.reactions
      where message_id = p_message_id
        and anonymous_user_id = p_user_id;
    raise exception 'message_not_found';
  end if;

  return jsonb_build_object('reaction_count', v_count, 'replayed', false);
end;
$$;
