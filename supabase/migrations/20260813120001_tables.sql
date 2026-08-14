-- Core tables. State is derived from timestamps, not a mutable status column.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  finalized_at timestamptz,
  configuration jsonb not null default '{}'::jsonb,
  constraint events_slug_unique unique (slug),
  constraint events_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint events_title_len check (char_length(title) between 1 and 80),
  constraint events_window_valid check (ends_at > starts_at),
  constraint events_archived_after_end check (
    archived_at is null or archived_at >= ends_at
  )
);

create table public.event_counters (
  event_id uuid primary key references public.events (id) on delete cascade,
  next_message_number integer not null default 1,
  total_messages integer not null default 0,
  total_reactions integer not null default 0,
  constraint event_counters_next_positive check (next_message_number >= 1),
  constraint event_counters_messages_nonneg check (total_messages >= 0),
  constraint event_counters_reactions_nonneg check (total_reactions >= 0)
);

create table public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id),
  anonymous_user_id uuid not null,
  message_text text not null,
  message_hash text not null,
  amount numeric(18, 6) not null,
  currency text not null,
  network text not null,
  recipient_wallet text not null,
  status text not null default 'created',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  constraint payment_intents_message_len check (
    char_length(message_text) between 1 and 560
  ),
  constraint payment_intents_hash_sha256 check (message_hash ~ '^[0-9a-f]{64}$'),
  constraint payment_intents_amount_one_usdc check (amount = 1),
  constraint payment_intents_currency_usdc check (currency = 'USDC'),
  constraint payment_intents_network check (network in ('base', 'base-sepolia')),
  constraint payment_intents_wallet check (recipient_wallet ~ '^0x[0-9a-f]{40}$'),
  constraint payment_intents_status check (
    status in ('created', 'expired', 'fulfilled', 'cancelled')
  ),
  constraint payment_intents_expiry check (expires_at > created_at),
  constraint payment_intents_fulfilled_state check (
    (status = 'fulfilled' and fulfilled_at is not null)
    or (status <> 'fulfilled' and fulfilled_at is null)
  )
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid not null references public.payment_intents (id),
  transaction_hash text not null,
  sender_wallet text not null,
  recipient_wallet text not null,
  amount numeric(18, 6) not null,
  currency text not null,
  network text not null,
  status text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  failure_reason text,
  constraint payments_intent_unique unique (payment_intent_id),
  constraint payments_tx_hash unique (transaction_hash),
  constraint payments_tx_format check (transaction_hash ~ '^0x[0-9a-f]{64}$'),
  constraint payments_sender check (sender_wallet ~ '^0x[0-9a-f]{40}$'),
  constraint payments_recipient check (recipient_wallet ~ '^0x[0-9a-f]{40}$'),
  constraint payments_amount_one_usdc check (amount = 1),
  constraint payments_currency_usdc check (currency = 'USDC'),
  constraint payments_network check (network in ('base', 'base-sepolia')),
  constraint payments_status check (status in ('completed', 'failed'))
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id),
  public_number integer not null,
  payment_intent_id uuid not null references public.payment_intents (id),
  text text not null,
  text_hash text not null,
  moderation_status text not null default 'approved',
  reaction_count integer not null default 0,
  published_at timestamptz not null default now(),
  final_rank integer,
  removed_at timestamptz,
  removal_reason_code text,
  constraint messages_event_number unique (event_id, public_number),
  constraint messages_payment_intent unique (payment_intent_id),
  constraint messages_number_positive check (public_number >= 1),
  constraint messages_text_len check (char_length(text) between 1 and 560),
  constraint messages_hash_sha256 check (text_hash ~ '^[0-9a-f]{64}$'),
  constraint messages_moderation check (
    moderation_status in ('pending', 'approved', 'rejected', 'flagged', 'removed')
  ),
  constraint messages_reactions_nonneg check (reaction_count >= 0),
  constraint messages_final_rank_positive check (final_rank is null or final_rank >= 1),
  constraint messages_removed_consistency check (
    (removed_at is null and removal_reason_code is null)
    or (removed_at is not null and removal_reason_code is not null)
  )
);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id),
  message_id uuid not null references public.messages (id),
  anonymous_user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint reactions_unique_user_message unique (message_id, anonymous_user_id)
);

create table public.message_ownership (
  message_id uuid primary key references public.messages (id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  constraint message_ownership_token_unique unique (token_hash),
  constraint message_ownership_token_sha256 check (token_hash ~ '^[0-9a-f]{64}$')
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id),
  reporter_user_id uuid not null,
  category text not null,
  detail text,
  created_at timestamptz not null default now(),
  status text not null default 'open',
  constraint reports_category check (
    category in ('hate', 'harassment', 'sexual', 'spam', 'illegal', 'other')
  ),
  constraint reports_detail_len check (detail is null or char_length(detail) <= 500),
  constraint reports_status check (status in ('open', 'reviewed', 'dismissed'))
);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id),
  action text not null,
  reason text,
  administrator_id uuid not null,
  created_at timestamptz not null default now(),
  constraint moderation_actions_action check (
    action in ('remove', 'restore', 'flag', 'approve')
  ),
  constraint moderation_actions_reason_required check (char_length(coalesce(reason, '')) >= 1)
);

create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  email text not null,
  created_at timestamptz not null default now(),
  constraint admin_users_auth_unique unique (auth_user_id),
  constraint admin_users_email_unique unique (email),
  constraint admin_users_email_format check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$')
);

-- Internal only. Not part of the public product model.
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start),
  constraint rate_limits_count_nonneg check (count >= 0)
);

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint analytics_events_name check (
    name in (
      'page_view',
      'compose_started',
      'payment_initiated',
      'payment_verified',
      'message_published',
      'reaction',
      'share',
      'certificate_viewed'
    )
  )
);

-- Public-safe realtime fanout. Never include wallets, tokens, or hashes.
create table public.public_message_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id),
  public_number integer not null,
  text text not null,
  reaction_count integer not null default 0,
  published_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint public_message_events_number_positive check (public_number >= 1)
);

create table public.payment_failures (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid references public.payment_intents (id),
  transaction_hash text,
  reason_code text not null,
  created_at timestamptz not null default now()
);

comment on table public.events is
  'A 24-hour wall. Phase is derived from timestamps, never a mutable status column.';
comment on table public.event_counters is
  'Per-event sequential numbering and aggregate totals. Incremented only inside RPCs.';
comment on table public.payment_intents is
  'Short-lived checkout records. Not readable by public clients.';
comment on table public.payments is
  'Verified on-chain settlements. Wallets and tx hashes are never public.';
comment on table public.messages is
  'Canonical monument text. Direct public SELECT is denied; use public_messages.';
comment on table public.reactions is
  'One fire per anonymous user per message. Identities are not public.';
comment on table public.message_ownership is
  'SHA-256 of the one-time certificate token. Raw tokens are never stored.';
comment on table public.reports is
  'User reports. Internal moderation only.';
comment on table public.moderation_actions is
  'Administrator audit log. Never exposed to public clients.';
comment on table public.admin_users is
  'Allowlist of administrator auth users. auth_user_id is not a hard FK so local Postgres can apply this schema.';
comment on table public.public_message_events is
  'Public-safe realtime fanout for newly published messages only.';
