-- Analytics: a single, anonymous event stream. No user data, no cookies —
-- just event names, an optional device id, and a timestamp. Written only by
-- the service_role through the /api/events route.

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  device_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_event_idx
  on analytics_events (event, created_at desc);

alter table analytics_events enable row level security;

-- No public reads or writes; the service_role (API) bypasses RLS.
create policy "analytics are private" on analytics_events
  for select using (false);

-- The /api/events route writes with the service_role, which needs an
-- explicit table grant when this file is applied manually (e.g. local dev).
grant insert, select on analytics_events to service_role;
