-- Reaction guards: rate limits enforced in the database so they cannot be
-- bypassed by calling the react() RPC directly. Every attempt is logged to
-- reaction_events (which also powers suspicious-activity analysis).
--
-- The device id (reactor_id) is issued by the server via an httpOnly cookie,
-- so clearing localStorage no longer resets a visitor's identity.

create table if not exists reaction_events (
  id bigint generated always as identity primary key,
  message_id uuid not null,
  reactor_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists reaction_events_reactor_time_idx
  on reaction_events (reactor_id, created_at desc);

alter table reaction_events enable row level security;

create policy "no direct reaction event access" on reaction_events
  for all using (false) with check (false);

-- The old react() returned boolean; the guarded version returns a status text,
-- so drop it first (create or replace cannot change the return type).
drop function if exists public.react(uuid, text);

-- Rate-limited react(). Returns a status code:
--   ok            reaction was counted
--   already       this device already reacted to this message
--   rate_limited  too many reactions in a short window
--   closed        wall frozen / ended / message not live
create or replace function public.react(mid uuid, rid text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted boolean;
  recent bigint;
  burst bigint;
begin
  if not exists (
    select 1 from messages m join walls w on w.id = m.wall_id
    where m.id = mid and m.status = 'live' and not w.frozen and w.ends_at > now()
  ) then
    return 'closed';
  end if;

  -- 30 reactions per device per minute.
  select count(*) into recent
    from reaction_events
    where reactor_id = rid and created_at > now() - interval '1 minute';
  if recent >= 30 then
    return 'rate_limited';
  end if;

  -- A burst of 6+ reactions in 10 seconds is not human behaviour.
  select count(*) into burst
    from reaction_events
    where reactor_id = rid and created_at > now() - interval '10 seconds';
  if burst >= 6 then
    return 'rate_limited';
  end if;

  insert into reaction_events (message_id, reactor_id)
  values (mid, rid);

  insert into reactions (message_id, reactor_id)
  values (mid, rid)
  on conflict (message_id, reactor_id) do nothing
  returning true into inserted;

  if inserted is null then
    return 'already';
  end if;

  update messages set reactions = reactions + 1 where id = mid;
  return 'ok';
end;
$$;

-- Reactions now only flow through the guarded API route (service role).
-- The anonymous/authenticated roles cannot call react() directly.
revoke execute on function public.react(uuid, text) from anon, authenticated;
grant execute on function public.react(uuid, text) to service_role;
