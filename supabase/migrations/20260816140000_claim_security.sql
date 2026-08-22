-- Winner-claim security: one-time challenges, short sessions, attempt audit.
-- Raw Wall Keys are never stored. Failed guesses are never hashed into this log.

create table if not exists public.claim_challenges (
  token_hash text primary key,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint claim_challenges_hash_sha256 check (token_hash ~ '^[0-9a-f]{64}$')
);

create table if not exists public.claim_sessions (
  token_hash text primary key,
  message_id uuid not null references public.messages (id),
  public_number integer not null,
  won boolean not null default false,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint claim_sessions_hash_sha256 check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint claim_sessions_number_positive check (public_number >= 1)
);

create table if not exists public.claim_attempts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id),
  public_number integer not null,
  outcome text not null,
  ip_hash text,
  created_at timestamptz not null default now(),
  constraint claim_attempts_number_positive check (public_number >= 1),
  constraint claim_attempts_outcome check (
    outcome in ('success', 'invalid', 'not_found', 'locked', 'rate_limited')
  )
);

create index if not exists claim_attempts_created_idx
  on public.claim_attempts (created_at desc);

comment on table public.claim_challenges is
  'One-time claim nonces. Hash only. Raw tokens live in an httpOnly cookie.';
comment on table public.claim_sessions is
  'Short-lived winner sessions after a Wall Key match. Hash only.';
comment on table public.claim_attempts is
  'Successful and failed claim outcomes. Never stores a Wall Key or its hash.';

alter table public.prize_nominations
  add column if not exists contact_email text;

alter table public.prize_nominations
  add column if not exists legal_acknowledged_at timestamptz;

alter table public.prize_nominations
  alter column payout_address drop not null;

alter table public.prize_nominations
  drop constraint if exists prize_nominations_method;

alter table public.prize_nominations
  add constraint prize_nominations_method
  check (payout_method in ('usdc', 'contact'));

alter table public.prize_nominations
  drop constraint if exists prize_nominations_address;

alter table public.prize_nominations
  add constraint prize_nominations_address
  check (payout_address is null or payout_address ~ '^0x[a-f0-9]{40}$');

alter table public.prize_nominations
  add constraint prize_nominations_delivery
  check (payout_address is not null or contact_email is not null);

comment on table public.prize_nominations is
  'Winner delivery details collected only after a verified Wall Key claim. Not public.';

alter table public.claim_challenges enable row level security;
alter table public.claim_sessions enable row level security;
alter table public.claim_attempts enable row level security;
alter table public.claim_challenges force row level security;
alter table public.claim_sessions force row level security;
alter table public.claim_attempts force row level security;

revoke all on public.claim_challenges from public, anon, authenticated;
revoke all on public.claim_sessions from public, anon, authenticated;
revoke all on public.claim_attempts from public, anon, authenticated;
grant all on public.claim_challenges to service_role;
grant all on public.claim_sessions to service_role;
grant all on public.claim_attempts to service_role;
