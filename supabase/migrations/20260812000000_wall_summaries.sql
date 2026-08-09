-- Public archive index: one row per wall (live and sealed) with rollups, so
-- the /archive page can list every wall's permanent record in a single query.

create or replace function public.wall_summaries(limit_count int default 100)
returns table (
  id uuid,
  title text,
  created_at timestamptz,
  ends_at timestamptz,
  frozen boolean,
  total_messages bigint,
  total_reactions bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    w.id, w.title, w.created_at, w.ends_at, w.frozen,
    (select count(*)::bigint from messages m
      where m.wall_id = w.id and m.status = 'live'),
    (select coalesce(sum(m.reactions), 0)::bigint from messages m
      where m.wall_id = w.id and m.status = 'live')
  from walls w
  order by w.created_at desc
  limit greatest(1, limit_count);
$$;

revoke execute on function public.wall_summaries(integer) from anon, authenticated;
grant execute on function public.wall_summaries(integer) to service_role;
