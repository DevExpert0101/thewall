-- The Monument: one Victor per sealed Wall. Created only by finalize_event_rankings.

alter table public.events
  add column if not exists theme_slug text,
  add column if not exists theme_question text,
  add column if not exists theme_description text,
  add column if not exists monument_entry_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_theme_slug_format'
  ) then
    alter table public.events
      add constraint events_theme_slug_format check (
        theme_slug is null or theme_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      );
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'events_theme_question_len'
  ) then
    alter table public.events
      add constraint events_theme_question_len check (
        theme_question is null or char_length(theme_question) between 1 and 280
      );
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'events_theme_description_len'
  ) then
    alter table public.events
      add constraint events_theme_description_len check (
        theme_description is null or char_length(theme_description) between 1 and 800
      );
  end if;
end
$$;

comment on column public.events.theme_slug is
  'Optional short theme key. Public title stays events.title.';
comment on column public.events.theme_question is
  'Central question of this Wall. Comes from the event record, never hardcoded UI.';
comment on column public.events.theme_description is
  'Optional steward description of this Wall''s theme.';

create table if not exists public.monument_state (
  singleton boolean primary key default true check (singleton),
  next_number integer not null default 1,
  capacity integer,
  constraint monument_state_next_positive check (next_number >= 1),
  constraint monument_state_capacity_positive check (capacity is null or capacity >= 1)
);

insert into public.monument_state (singleton, next_number, capacity)
values (true, 1, null)
on conflict (singleton) do nothing;

comment on table public.monument_state is
  'Atomic Monument numbering. capacity is optional and unpublished unless set.';

create table if not exists public.monument_entries (
  id uuid primary key default gen_random_uuid(),
  monument_number integer not null,
  event_id uuid not null references public.events (id),
  message_id uuid not null references public.messages (id),
  original_public_number integer not null,
  final_reaction_count integer not null,
  final_rank integer not null default 1,
  winning_margin integer not null,
  wall_total_messages integer not null,
  wall_total_reactions integer not null,
  sealed_at timestamptz not null,
  archive_hash text,
  created_at timestamptz not null default now(),
  constraint monument_entries_number_unique unique (monument_number),
  constraint monument_entries_event_unique unique (event_id),
  constraint monument_entries_message_unique unique (message_id),
  constraint monument_entries_number_positive check (monument_number >= 1),
  constraint monument_entries_public_number_positive check (original_public_number >= 1),
  constraint monument_entries_reactions_nonneg check (final_reaction_count >= 0),
  constraint monument_entries_rank_first check (final_rank = 1),
  constraint monument_entries_margin_nonneg check (winning_margin >= 0),
  constraint monument_entries_totals_nonneg check (
    wall_total_messages >= 0 and wall_total_reactions >= 0
  ),
  constraint monument_entries_archive_hash_sha256 check (
    archive_hash is null or archive_hash ~ '^[0-9a-f]{64}$'
  )
);

comment on table public.monument_entries is
  'Permanent Victors. One row per sealed Wall. Public clients may SELECT; they cannot write.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_monument_entry_fk'
  ) then
    alter table public.events
      add constraint events_monument_entry_fk
      foreign key (monument_entry_id) references public.monument_entries (id)
      on delete set null;
  end if;
end
$$;

create or replace view public.public_monument_entries
with (security_invoker = false) as
select
  e.id,
  e.monument_number,
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
    else m.text
  end as text,
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

comment on view public.public_monument_entries is
  'Public Monument catalog. Removed Victors keep their number; the sentence is redacted.';

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
    -- Tie policy: highest 🔥, then earlier published_at, then lowest public_number.
    -- Same historical rows always produce the same Victor. No randomness.
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
  if v_state.capacity is not null and v_state.next_number > v_state.capacity then
    raise exception 'monument_capacity_reached';
  end if;

  select * into v_totals from public.event_counters where event_id = p_event_id;
  select reaction_count into v_second
    from public.messages
    where event_id = p_event_id and final_rank = 2
    limit 1;
  v_margin := v_winner.reaction_count - coalesce(v_second, 0);

  insert into public.monument_entries (
    monument_number,
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
  'Locks the Wall, writes deterministic final ranks, selects the Victor, and seals one Monument entry. Idempotent.';

-- Backfill already-sealed Walls that have a rank #1 and no Monument row.
do $$
declare
  rec record;
begin
  for rec in
    select e.id
    from public.events e
    where e.finalized_at is not null
      and e.monument_entry_id is null
      and exists (
        select 1 from public.messages m
        where m.event_id = e.id and m.final_rank = 1
      )
    order by e.finalized_at asc, e.edition_number asc
  loop
    perform public.finalize_event_rankings(rec.id);
  end loop;
end
$$;

alter table public.monument_entries enable row level security;
alter table public.monument_state enable row level security;
alter table public.monument_entries force row level security;
alter table public.monument_state force row level security;

drop policy if exists monument_entries_public_read on public.monument_entries;
create policy monument_entries_public_read on public.monument_entries
  for select to anon, authenticated
  using (true);

drop policy if exists monument_entries_deny_write on public.monument_entries;
create policy monument_entries_deny_write on public.monument_entries
  for all to anon, authenticated
  using (false) with check (false);

drop policy if exists monument_state_deny on public.monument_state;
create policy monument_state_deny on public.monument_state
  for all to anon, authenticated
  using (false) with check (false);

grant select on public.monument_entries to anon, authenticated, service_role;
grant select on public.public_monument_entries to anon, authenticated, service_role;
grant all on public.monument_entries to service_role;
grant all on public.monument_state to service_role;

revoke all on public.monument_state from public, anon, authenticated;
revoke all on function public.finalize_event_rankings(uuid) from public, anon, authenticated;
grant execute on function public.finalize_event_rankings(uuid) to service_role;
