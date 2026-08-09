-- Velocity-based trending inputs. Raw reaction count rewards the earliest
-- poster; the client blends these inputs into a trend score:
--
--   trend = sqrt(reaction velocity) × engagement quality × time adjustment
--
-- where reaction velocity = recent reactions per minute in the last 30 min
-- (falling back to lifetime rate for legacy messages), engagement quality
-- rewards organic spread (distinct reactors over recent reactions), and the
-- time adjustment keeps the feed responsive so a message posted 18 hours into
-- the event can still explode.
create or replace function public.trend_scores(wall_id uuid)
returns table (
  message_id uuid,
  recent_reactions bigint,
  distinct_recent bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
  with recent as (
    select message_id,
           count(*) as cnt,
           count(distinct reactor_id) as distinct_cnt
    from reaction_events
    where created_at > now() - interval '30 minutes'
    group by message_id
  )
  select m.id as message_id,
         coalesce(r.cnt, 0) as recent_reactions,
         coalesce(r.distinct_cnt, 0) as distinct_recent
  from messages m
  left join recent r on r.message_id = m.id
  where m.wall_id = wall_id and m.status = 'live';
end;
$$;

revoke all on function public.trend_scores(uuid) from public, anon, authenticated;
grant execute on function public.trend_scores(uuid) to service_role;
