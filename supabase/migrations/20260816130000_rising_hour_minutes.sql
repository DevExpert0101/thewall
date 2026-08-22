-- Rising needs distinct minutes in the last hour so a one-minute pile
-- is visible as spread, not as a secret weight.

drop function if exists public.hour_reaction_counts(uuid, timestamptz, integer);

create function public.hour_reaction_counts(
  p_event_id uuid,
  p_since timestamptz,
  p_limit integer
)
returns table(message_id uuid, hour_count bigint, hour_minutes bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.message_id,
    count(*)::bigint as hour_count,
    count(distinct date_trunc('minute', r.created_at))::bigint as hour_minutes
  from public.reactions r
  where r.event_id = p_event_id
    and r.created_at >= p_since
  group by r.message_id
  order by count(*) desc
  limit least(greatest(coalesce(p_limit, 200), 1), 200);
$$;

revoke all on function public.hour_reaction_counts(uuid, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.hour_reaction_counts(uuid, timestamptz, integer)
  to service_role;
