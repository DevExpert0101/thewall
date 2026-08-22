-- Viral read/write: shorter 🔥 locks, covering index for the hour aggregate.
-- Do not hold the message row while checking live/idempotency.

drop index if exists public.reactions_event_created_idx;

create index if not exists reactions_event_created_message_idx
  on public.reactions (event_id, created_at desc, message_id);

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
  v_count integer;
begin
  select event_id, removed_at, reaction_count
    into v_event_id, v_removed, v_count
    from public.messages
    where id = p_message_id;

  if not found then
    raise exception 'message_not_found';
  end if;

  if v_removed is not null then
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
      and removed_at is null
    returning reaction_count into v_count;

  if v_count is null then
    delete from public.reactions
      where message_id = p_message_id
        and anonymous_user_id = p_user_id;
    raise exception 'message_not_found';
  end if;

  update public.event_counters
    set total_reactions = total_reactions + 1
    where event_id = v_event_id;

  return jsonb_build_object('reaction_count', v_count, 'replayed', false);
end;
$$;
