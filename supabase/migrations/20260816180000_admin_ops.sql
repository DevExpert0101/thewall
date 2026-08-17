-- Launch-day operations: audit every stewardship action.
-- Kill switches live in events.configuration.ops and never touch starts_at / ends_at.

comment on column public.events.configuration is
  'Operator JSON. Known keys: ops.publishEnabled, ops.reactEnabled, ops.strictBot. Clock fields stay on starts_at / ends_at.';

create table public.admin_ops_actions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id),
  action text not null,
  actor_id text,
  actor_email text,
  before jsonb not null default '{}'::jsonb,
  after jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_ops_actions_action_len check (char_length(action) between 1 and 64)
);

comment on table public.admin_ops_actions is
  'Stewardship actions. Never exposed publicly. No secrets, wallets, IPs, or Wall Keys.';

create index admin_ops_actions_created_idx
  on public.admin_ops_actions (created_at desc);

create index admin_ops_actions_event_idx
  on public.admin_ops_actions (event_id, created_at desc);

alter table public.admin_ops_actions enable row level security;
alter table public.admin_ops_actions force row level security;

create policy admin_ops_actions_deny on public.admin_ops_actions
  for all
  using (false)
  with check (false);

grant all on public.admin_ops_actions to service_role;
revoke all on public.admin_ops_actions from public, anon, authenticated;
