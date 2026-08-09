-- Admin controls: allow pausing submissions without freezing the wall.
-- A paused wall is still visible and readable; only new checkouts are blocked.

alter table walls add column if not exists accepting boolean not null default true;

-- ---- Dashboard metrics -----------------------------------------------------
-- One query for the admin dashboard. Rates (per-minute) are derived by the
-- API from the 5-minute windows.
create or replace function public.admin_stats(wid uuid)
returns table (
  total_messages bigint,
  live_messages bigint,
  total_reactions bigint,
  messages_5m bigint,
  reactions_5m bigint,
  active_users bigint,
  total_devices bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
  select
    (select count(*) from messages where wall_id = wid) as total_messages,
    (select count(*) from messages where wall_id = wid and status = 'live') as live_messages,
    (select coalesce(sum(reactions), 0) from messages where wall_id = wid and status = 'live') as total_reactions,
    (select count(*) from messages where wall_id = wid and created_at > now() - interval '5 minutes') as messages_5m,
    (select count(*) from reaction_events e join messages m on m.id = e.message_id where m.wall_id = wid and e.created_at > now() - interval '5 minutes') as reactions_5m,
    (select count(distinct reactor_id) from reaction_events e join messages m on m.id = e.message_id where m.wall_id = wid and e.created_at > now() - interval '30 minutes') as active_users,
    (select count(distinct reactor_id) from reactions r join messages m on m.id = r.message_id where m.wall_id = wid) as total_devices;
end;
$$;

revoke execute on function public.admin_stats(uuid) from anon, authenticated;
grant execute on function public.admin_stats(uuid) to service_role;

-- ---- Payment health --------------------------------------------------------
create or replace function public.payment_status_counts()
returns table (status text, count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select status, count(*)::bigint
  from payments
  group by status;
$$;

revoke execute on function public.payment_status_counts() from anon, authenticated;
grant execute on function public.payment_status_counts() to service_role;

