-- Fix: the OUT parameter "message_id" collided with reaction_events.message_id
-- (PL/pgSQL 42702). Rename the returned column to msg_id. The return type
-- changed, so drop the old signature first.
drop function if exists public.trend_scores(uuid);

-- The parameter is named wid so it cannot collide with messages.wall_id.
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
