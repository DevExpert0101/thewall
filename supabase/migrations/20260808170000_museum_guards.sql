-- ============================================================================
-- The Wall must actually die.
--
-- When the clock hits zero (or the wall is sealed) the wall becomes a museum
-- exhibit. These guards enforce that at the database layer, so the freeze is
-- not merely a client-side flag:
--
--   DISABLED  · new messages   → messages_no_new_after_death (insert guard)
--             · editing        → messages_no_edit_after_death (update guard)
--             · deletion       → messages_no_delete_after_death (delete guard)
--             · new reactions  → react() already returns 'closed'
--             · ranking drift  → trend_scores() stops the clock at the wall's
--                                end, so the final ranking is permanent
--   KEPT      · browsing / searching / sharing / certificates / downloads
--
-- react() and confirm_payment() check the wall's liveness before they write,
-- so these triggers only ever fire on genuinely dead walls.
-- ============================================================================

-- No new messages on a wall that is over.
create or replace function public.guard_messages_live()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from walls w
    where w.id = new.wall_id and (w.frozen or w.ends_at <= now())
  ) then
    raise exception 'The Wall has closed. New messages cannot be added.';
  end if;
  return new;
end;
$$;

create trigger messages_no_new_after_death
before insert on messages
for each row execute function public.guard_messages_live();

-- No edits once the wall is over.
create or replace function public.guard_messages_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from walls w
    where w.id = old.wall_id and (w.frozen or w.ends_at <= now())
  ) then
    raise exception 'The Wall is sealed. Messages are permanent and cannot be edited.';
  end if;
  return new;
end;
$$;

create trigger messages_no_edit_after_death
before update on messages
for each row execute function public.guard_messages_update();

-- No deletions once the wall is over.
create or replace function public.guard_messages_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from walls w
    where w.id = old.wall_id and (w.frozen or w.ends_at <= now())
  ) then
    raise exception 'The Wall is sealed. Messages are permanent and cannot be deleted.';
  end if;
  return old;
end;
$$;

create trigger messages_no_delete_after_death
before delete on messages
for each row execute function public.guard_messages_delete();

-- ---------------------------------------------------------------------------
-- Ranking is frozen too. trend_scores() measured "the last 30 minutes" from
-- now(), so a wall that had been dead for a day showed zero recent reactions
-- and its trend ranking kept decaying forever. Now the clock stops at the
-- wall's end: the 30-minute window is anchored to ends_at, making the final
-- ranking permanent.
-- ---------------------------------------------------------------------------
drop function if exists public.trend_scores(uuid);

create or replace function public.trend_scores(wid uuid)
returns table (
  msg_id uuid,
  recent_reactions bigint,
  distinct_recent bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  ref_now timestamptz;
begin
  select case
           when w.frozen or w.ends_at <= now() then w.ends_at
           else now()
         end
    into ref_now
    from walls w
    where w.id = wid;

  return query
  with recent as (
    select message_id,
           count(*) as cnt,
           count(distinct reactor_id) as distinct_cnt
    from reaction_events
    where created_at > ref_now - interval '30 minutes'
    group by message_id
  )
  select m.id as msg_id,
         coalesce(r.cnt, 0) as recent_reactions,
         coalesce(r.distinct_cnt, 0) as distinct_recent
  from messages m
  left join recent r on r.message_id = m.id
  where m.wall_id = wid and m.status = 'live';
end;
$$;

revoke all on function public.trend_scores(uuid) from public, anon, authenticated;
grant execute on function public.trend_scores(uuid) to service_role;

notify pgrst, 'reload schema';
