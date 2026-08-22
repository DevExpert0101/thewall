-- Finish ranks only living sentences. A removal before seal drops that
-- row from Victor selection. After seal, ranks stay put.

create or replace function public.finalize_event_rankings(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_winner public.messages;
  v_second integer;
  v_margin integer;
  v_totals public.event_counters;
  v_state public.monument_state;
  v_entry public.monument_entries;
  v_has_winner boolean;
  v_plot record;
  v_cols integer;
  v_rows integer;
  v_cap integer;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    raise exception 'event_not_found';
  end if;
  if now() < v_event.ends_at then
    raise exception 'event_still_live';
  end if;

  if v_event.finalized_at is not null then
    if v_event.monument_entry_id is not null then
      return;
    end if;
    if exists (select 1 from public.monument_entries where event_id = p_event_id) then
      return;
    end if;
  else
    update public.messages
      set final_rank = null
      where event_id = p_event_id
        and removed_at is not null;

    with ranked as (
      select
        id,
        row_number() over (
          order by reaction_count desc, published_at asc, public_number asc
        ) as rnk
      from public.messages
      where event_id = p_event_id
        and removed_at is null
    )
    update public.messages m
      set final_rank = ranked.rnk
      from ranked
      where m.id = ranked.id;

    select * into v_winner
      from public.messages
      where event_id = p_event_id and final_rank = 1
      limit 1;
    v_has_winner := found;

    update public.events
      set finalized_at = now(),
          archived_at = coalesce(archived_at, now()),
          winning_message_id = case when v_has_winner then v_winner.id else null end
      where id = p_event_id
      returning * into v_event;
  end if;

  if v_event.winning_message_id is null then
    select * into v_winner
      from public.messages
      where event_id = p_event_id and final_rank = 1
      limit 1;
  else
    select * into v_winner
      from public.messages
      where id = v_event.winning_message_id;
  end if;

  if not found then
    return;
  end if;

  select * into v_entry
    from public.monument_entries
    where event_id = p_event_id or message_id = v_winner.id
    limit 1;
  if found then
    update public.events
      set monument_entry_id = v_entry.id,
          winning_message_id = coalesce(winning_message_id, v_winner.id)
      where id = p_event_id;
    return;
  end if;

  select * into v_state from public.monument_state where singleton = true for update;
  if not found then
    insert into public.monument_state (singleton, next_number)
    values (true, 1)
    returning * into v_state;
  end if;
  v_cols := v_state.canvas_width / v_state.cell_width;
  v_rows := v_state.canvas_height / v_state.cell_height;
  v_cap := coalesce(v_state.capacity, v_cols * v_rows);
  if v_state.next_number > v_cap then
    raise exception 'monument_capacity_reached';
  end if;

  select * into v_plot from public.monument_plot(v_state.next_number);

  select * into v_totals from public.event_counters where event_id = p_event_id;
  select reaction_count into v_second
    from public.messages
    where event_id = p_event_id and final_rank = 2
    limit 1;
  v_margin := v_winner.reaction_count - coalesce(v_second, 0);

  insert into public.monument_entries (
    monument_number,
    position,
    x,
    y,
    width,
    height,
    sentence_snapshot,
    event_id,
    message_id,
    original_public_number,
    final_reaction_count,
    final_rank,
    winning_margin,
    wall_total_messages,
    wall_total_reactions,
    sealed_at,
    archive_hash
  ) values (
    v_state.next_number,
    v_state.next_number,
    v_plot.x,
    v_plot.y,
    v_plot.width,
    v_plot.height,
    v_winner.text,
    p_event_id,
    v_winner.id,
    v_winner.public_number,
    v_winner.reaction_count,
    1,
    v_margin,
    coalesce(v_totals.total_messages, 0),
    coalesce(v_totals.total_reactions, 0),
    coalesce(v_event.finalized_at, now()),
    v_event.archive_hash
  )
  returning * into v_entry;

  update public.monument_state
    set next_number = next_number + 1
    where singleton = true;

  update public.events
    set monument_entry_id = v_entry.id,
        winning_message_id = v_winner.id
    where id = p_event_id;
end;
$$;

comment on function public.finalize_event_rankings(uuid) is
  'Seals living-only ranks, selects the Victor, and writes that sentence into the next canvas plot. Removed sentences are skipped at Finish. Idempotent after seal.';

revoke all on function public.finalize_event_rankings(uuid) from public, anon, authenticated;
grant execute on function public.finalize_event_rankings(uuid) to service_role;
