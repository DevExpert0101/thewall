-- Row Level Security. The browser uses the anon key. The Next.js server uses
-- the service role, which has BYPASSRLS and must never be shipped to the client.

alter table public.events enable row level security;
alter table public.event_counters enable row level security;
alter table public.payment_intents enable row level security;
alter table public.payments enable row level security;
alter table public.messages enable row level security;
alter table public.reactions enable row level security;
alter table public.message_ownership enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.admin_users enable row level security;
alter table public.rate_limits enable row level security;
alter table public.analytics_events enable row level security;
alter table public.public_message_events enable row level security;
alter table public.payment_failures enable row level security;

-- Force RLS on tables that must never leak even to the table owner in a
-- misconfigured role. Superuser / BYPASSRLS (service_role) still bypasses.
alter table public.payment_intents force row level security;
alter table public.payments force row level security;
alter table public.reactions force row level security;
alter table public.message_ownership force row level security;
alter table public.reports force row level security;
alter table public.moderation_actions force row level security;
alter table public.admin_users force row level security;
alter table public.rate_limits force row level security;
alter table public.analytics_events force row level security;
alter table public.payment_failures force row level security;

create policy events_public_read on public.events
  for select to anon, authenticated
  using (true);

create policy counters_public_read on public.event_counters
  for select to anon, authenticated
  using (true);

-- Direct SELECT on messages would expose original text of removed rows and
-- hashes. Public clients must use public_messages instead.
create policy messages_no_direct_public_select on public.messages
  for select to anon, authenticated
  using (false);

create policy message_events_public_read on public.public_message_events
  for select to anon, authenticated
  using (true);

create policy payment_intents_deny on public.payment_intents
  for all to anon, authenticated
  using (false) with check (false);

create policy payments_deny on public.payments
  for all to anon, authenticated
  using (false) with check (false);

create policy reactions_deny on public.reactions
  for all to anon, authenticated
  using (false) with check (false);

create policy ownership_deny on public.message_ownership
  for all to anon, authenticated
  using (false) with check (false);

create policy reports_deny on public.reports
  for all to anon, authenticated
  using (false) with check (false);

create policy moderation_deny on public.moderation_actions
  for all to anon, authenticated
  using (false) with check (false);

create policy admin_users_deny on public.admin_users
  for all to anon, authenticated
  using (false) with check (false);

create policy rate_limits_deny on public.rate_limits
  for all to anon, authenticated
  using (false) with check (false);

create policy analytics_deny on public.analytics_events
  for all to anon, authenticated
  using (false) with check (false);

create policy payment_failures_deny on public.payment_failures
  for all to anon, authenticated
  using (false) with check (false);

-- Privileges. Default PUBLIC execute on functions is revoked below.
grant usage on schema public to anon, authenticated, service_role;

grant select on public.events to anon, authenticated, service_role;
grant select on public.event_counters to anon, authenticated, service_role;
grant select on public.public_messages to anon, authenticated, service_role;
grant select on public.public_message_events to anon, authenticated, service_role;

grant all on public.events to service_role;
grant all on public.event_counters to service_role;
grant all on public.payment_intents to service_role;
grant all on public.payments to service_role;
grant all on public.messages to service_role;
grant all on public.reactions to service_role;
grant all on public.message_ownership to service_role;
grant all on public.reports to service_role;
grant all on public.moderation_actions to service_role;
grant all on public.admin_users to service_role;
grant all on public.rate_limits to service_role;
grant all on public.analytics_events to service_role;
grant all on public.public_message_events to service_role;
grant all on public.payment_failures to service_role;

revoke all on public.payment_intents from public, anon, authenticated;
revoke all on public.payments from public, anon, authenticated;
revoke all on public.messages from public, anon, authenticated;
revoke all on public.reactions from public, anon, authenticated;
revoke all on public.message_ownership from public, anon, authenticated;
revoke all on public.reports from public, anon, authenticated;
revoke all on public.moderation_actions from public, anon, authenticated;
revoke all on public.admin_users from public, anon, authenticated;
revoke all on public.rate_limits from public, anon, authenticated;
revoke all on public.analytics_events from public, anon, authenticated;
revoke all on public.payment_failures from public, anon, authenticated;

revoke all on function public.publish_paid_message(uuid, text, text, text, numeric, text, text, text)
  from public, anon, authenticated;
revoke all on function public.add_fire_reaction(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_event_rankings(uuid)
  from public, anon, authenticated;
revoke all on function public.consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.assert_event_live(uuid)
  from public, anon, authenticated;
revoke all on function public.ensure_event_counter()
  from public, anon, authenticated;

grant execute on function public.publish_paid_message(uuid, text, text, text, numeric, text, text, text)
  to service_role;
grant execute on function public.add_fire_reaction(uuid, uuid)
  to service_role;
grant execute on function public.finalize_event_rankings(uuid)
  to service_role;
grant execute on function public.consume_rate_limit(text, integer, integer)
  to service_role;
grant execute on function public.assert_event_live(uuid)
  to service_role;
grant execute on function public.event_phase(public.events)
  to service_role;

-- Realtime: only the public-safe message event table.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.public_message_events';
  end if;
exception
  when duplicate_object then null;
end;
$$;
