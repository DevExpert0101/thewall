-- Read-path helpers for a live traffic spike: one round-trip for the wall pulse,
-- and hour ranking aggregated in Postgres instead of shipping every reaction row.

create or replace function public.wall_pulse(p_event_id uuid, p_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_messages integer := 0;
  v_reactions integer := 0;
  v_counts jsonb := '{}'::jsonb;
  v_ids uuid[];
begin
  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'event_not_found';
  end if;

  select c.total_messages, c.total_reactions
    into v_messages, v_reactions
    from public.event_counters c
    where c.event_id = p_event_id;

  v_ids := (coalesce(p_ids, '{}'::uuid[]))[1:48];
  if cardinality(v_ids) > 0 then
    select coalesce(jsonb_object_agg(m.id::text, m.reaction_count), '{}'::jsonb)
      into v_counts
      from public.messages m
      where m.event_id = p_event_id
        and m.id = any (v_ids);
  end if;

  return jsonb_build_object(
    'starts_at', v_event.starts_at,
    'ends_at', v_event.ends_at,
    'archived_at', v_event.archived_at,
    'finalized_at', v_event.finalized_at,
    'total_messages', coalesce(v_messages, 0),
    'total_reactions', coalesce(v_reactions, 0),
    'counts', coalesce(v_counts, '{}'::jsonb)
  );
end;
$$;

create or replace function public.hour_reaction_counts(
  p_event_id uuid,
  p_since timestamptz,
  p_limit integer
)
returns table(message_id uuid, hour_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select r.message_id, count(*)::bigint as hour_count
  from public.reactions r
  where r.event_id = p_event_id
    and r.created_at >= p_since
  group by r.message_id
  order by count(*) desc
  limit least(greatest(coalesce(p_limit, 200), 1), 200);
$$;

revoke all on function public.wall_pulse(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.hour_reaction_counts(uuid, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.wall_pulse(uuid, uuid[]) to service_role;
grant execute on function public.hour_reaction_counts(uuid, timestamptz, integer)
  to service_role;
