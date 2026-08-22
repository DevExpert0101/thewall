-- Permanent sentence canvas: equal plots, left-to-right, top-to-bottom.

alter table public.monument_state
  add column if not exists canvas_width integer,
  add column if not exists canvas_height integer,
  add column if not exists cell_width integer,
  add column if not exists cell_height integer;

update public.monument_state
set
  canvas_width = coalesce(canvas_width, 8960),
  canvas_height = coalesce(canvas_height, 5376),
  cell_width = coalesce(cell_width, 280),
  cell_height = coalesce(cell_height, 168)
where singleton = true;

alter table public.monument_state
  alter column canvas_width set default 8960,
  alter column canvas_height set default 5376,
  alter column cell_width set default 280,
  alter column cell_height set default 168,
  alter column canvas_width set not null,
  alter column canvas_height set not null,
  alter column cell_width set not null,
  alter column cell_height set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'monument_state_canvas_positive'
  ) then
    alter table public.monument_state
      add constraint monument_state_canvas_positive check (
        canvas_width >= 1 and canvas_height >= 1
        and cell_width >= 1 and cell_height >= 1
        and canvas_width >= cell_width
        and canvas_height >= cell_height
      );
  end if;
end
$$;

comment on column public.monument_state.canvas_width is
  'Logical canvas width in pixels. Historical plots never move when this is read.';
comment on column public.monument_state.cell_width is
  'Equal plot width for every Victor. Not sold. Not featured.';

alter table public.monument_entries
  add column if not exists position integer,
  add column if not exists x integer,
  add column if not exists y integer,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists sentence_snapshot text;

create or replace function public.monument_plot(p_position integer)
returns table (x integer, y integer, width integer, height integer)
language plpgsql
stable
set search_path = public
as $$
declare
  v_state public.monument_state;
  v_cols integer;
begin
  if p_position is null or p_position < 1 then
    raise exception 'invalid_monument_position';
  end if;
  select * into v_state from public.monument_state where singleton = true;
  if not found then
    raise exception 'monument_state_missing';
  end if;
  v_cols := v_state.canvas_width / v_state.cell_width;
  if v_cols < 1 then
    raise exception 'monument_canvas_invalid';
  end if;
  return query
    select
      ((p_position - 1) % v_cols) * v_state.cell_width,
      ((p_position - 1) / v_cols) * v_state.cell_height,
      v_state.cell_width,
      v_state.cell_height;
end;
$$;

revoke all on function public.monument_plot(integer) from public, anon, authenticated;
grant execute on function public.monument_plot(integer) to service_role;

update public.monument_entries e
set
  position = coalesce(e.position, e.monument_number),
  sentence_snapshot = coalesce(e.sentence_snapshot, m.text),
  x = coalesce(
    e.x,
    ((coalesce(e.position, e.monument_number) - 1) % (s.canvas_width / s.cell_width)) * s.cell_width
  ),
  y = coalesce(
    e.y,
    ((coalesce(e.position, e.monument_number) - 1) / (s.canvas_width / s.cell_width)) * s.cell_height
  ),
  width = coalesce(e.width, s.cell_width),
  height = coalesce(e.height, s.cell_height)
from public.messages m, public.monument_state s
where m.id = e.message_id
  and s.singleton = true
  and (e.position is null or e.x is null or e.sentence_snapshot is null);

alter table public.monument_entries
  alter column position set not null,
  alter column x set not null,
  alter column y set not null,
  alter column width set not null,
  alter column height set not null,
  alter column sentence_snapshot set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'monument_entries_position_unique'
  ) then
    alter table public.monument_entries
      add constraint monument_entries_position_unique unique (position);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'monument_entries_plot_nonneg'
  ) then
    alter table public.monument_entries
      add constraint monument_entries_plot_nonneg check (
        position >= 1 and x >= 0 and y >= 0 and width >= 1 and height >= 1
      );
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'monument_entries_snapshot_len'
  ) then
    alter table public.monument_entries
      add constraint monument_entries_snapshot_len check (
        char_length(sentence_snapshot) between 1 and 560
      );
  end if;
end
$$;

drop view if exists public.public_monument_entries;
create view public.public_monument_entries
with (security_invoker = false) as
select
  e.id,
  e.monument_number,
  e.position,
  e.x,
  e.y,
  e.width,
  e.height,
  e.event_id,
  ev.edition_number,
  ev.title as theme_title,
  ev.theme_slug,
  ev.theme_question,
  ev.theme_description,
  ev.starts_at,
  ev.ends_at,
  e.message_id,
  e.original_public_number,
  case
    when m.removed_at is not null then 'Message removed under archive policy.'
    else coalesce(e.sentence_snapshot, m.text)
  end as text,
  case
    when m.removed_at is not null then 'Message removed under archive policy.'
    else coalesce(e.sentence_snapshot, m.text)
  end as sentence_snapshot,
  (m.removed_at is not null) as is_removed,
  e.final_reaction_count,
  e.final_rank,
  e.winning_margin,
  e.wall_total_messages,
  e.wall_total_reactions,
  m.published_at,
  e.sealed_at,
  coalesce(e.archive_hash, ev.archive_hash) as archive_hash,
  ev.merkle_root,
  e.created_at
from public.monument_entries e
join public.events ev on ev.id = e.event_id
join public.messages m on m.id = e.message_id;

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
  'Seals ranks, selects the Victor, and writes that sentence into the next canvas plot. Idempotent.';

revoke all on function public.finalize_event_rankings(uuid) from public, anon, authenticated;
grant execute on function public.finalize_event_rankings(uuid) to service_role;
grant select on public.public_monument_entries to anon, authenticated, service_role;
