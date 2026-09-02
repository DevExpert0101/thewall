-- Sticky close-for-review. Clock rollback and a later expire() cannot
-- reopen writes. Results stay private until Finish.

alter table public.events
  add column if not exists review_closed_at timestamptz;

comment on column public.events.review_closed_at is
  'Set when the Wall is closed for review. Phase stays finalizing even if now() steps behind ends_at.';

create or replace function public.event_phase(p_event public.events)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_event.archived_at is not null and now() >= p_event.archived_at then 'archived'
    when p_event.finalized_at is not null and now() >= p_event.ends_at then 'archived'
    when p_event.review_closed_at is not null then 'finalizing'
    when now() < p_event.starts_at then 'upcoming'
    when now() < p_event.ends_at then 'live'
    else 'finalizing'
  end;
$$;

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
  v_next integer := 1;
  v_counts jsonb := '{}'::jsonb;
  v_ids uuid[];
begin
  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'event_not_found';
  end if;

  select c.total_messages, c.total_reactions, c.next_message_number
    into v_messages, v_reactions, v_next
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
    'review_closed_at', v_event.review_closed_at,
    'total_messages', coalesce(v_messages, 0),
    'total_reactions', coalesce(v_reactions, 0),
    'latest_public_number', greatest(coalesce(v_messages, 0), coalesce(v_next, 1) - 1),
    'counts', coalesce(v_counts, '{}'::jsonb)
  );
end;
$$;
