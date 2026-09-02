-- Close the two integrity gaps the OWASP/DB audit called out:
--   1. Two living (or sealed) sentences could share a final_rank via service_role.
--   2. messages.reaction_count / event_counters.total_reactions could drift
--      from the reactions table.
--
-- UNIQUE (event_id, final_rank) is DEFERRABLE so finalize_event_rankings can
-- reassign every living row in one UPDATE without a mid-statement clash.
-- NULL ranks stay allowed (PostgreSQL unique treats NULLs as distinct), so
-- sentences skipped at Finish and not-yet-ranked rows are fine.
-- A partial UNIQUE (... WHERE removed_at IS NULL) would drop a post-seal
-- redaction out of the index and allow a second #1. Ranks stay after seal.

alter table public.messages
  drop constraint if exists messages_event_rank_unique;

alter table public.messages
  add constraint messages_event_rank_unique
  unique (event_id, final_rank)
  deferrable initially deferred;

comment on constraint messages_event_rank_unique on public.messages is
  'One rank per event. Deferred so Finish can rewrite the set in one statement. NULL ranks are unassigned.';

create or replace function public.sync_reaction_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_event_ids uuid[];
begin
  if tg_op = 'DELETE' then
    v_ids := array[old.message_id];
    v_event_ids := array[old.event_id];
  elsif tg_op = 'UPDATE' then
    v_ids := array[old.message_id, new.message_id];
    v_event_ids := array[old.event_id, new.event_id];
  else
    v_ids := array[new.message_id];
    v_event_ids := array[new.event_id];
  end if;

  v_event_ids := coalesce(v_event_ids, '{}'::uuid[]) || coalesce(
    (select array_agg(m.event_id) from public.messages m where m.id = any (v_ids)),
    '{}'::uuid[]
  );

  update public.messages m
    set reaction_count = (
      select count(*)::integer from public.reactions r where r.message_id = m.id
    )
    where m.id = any (v_ids);

  update public.event_counters c
    set total_reactions = (
      select coalesce(sum(m.reaction_count), 0)::integer
      from public.messages m
      where m.event_id = c.event_id
    )
    where c.event_id = any (v_event_ids);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists reactions_sync_counts on public.reactions;

create trigger reactions_sync_counts
after insert or update or delete on public.reactions
for each row
execute procedure public.sync_reaction_counts();

comment on function public.sync_reaction_counts() is
  'Keeps messages.reaction_count and event_counters.total_reactions equal to reaction rows.';

revoke all on function public.sync_reaction_counts() from public, anon, authenticated;

-- Count is now the trigger's job. The RPC only inserts (or rolls back) the row.
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

  select removed_at, reaction_count
    into v_removed, v_count
    from public.messages
    where id = p_message_id;

  if v_removed is not null or v_count is null then
    delete from public.reactions
      where message_id = p_message_id
        and anonymous_user_id = p_user_id;
    raise exception 'message_not_found';
  end if;

  return jsonb_build_object('reaction_count', v_count, 'replayed', false);
end;
$$;
