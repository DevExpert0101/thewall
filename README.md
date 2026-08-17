# THE WALL

One day. One dollar. One sentence forever.

A 24-hour anonymous monument: anyone can read it, 1.00 USDC on Base publishes one 140-character sentence, and when the clock reaches zero that day is sealed as a numbered edition in the Archive.

This application is built for Vercel’s serverless model. There is no long-running Node process, no custom WebSocket server, and no Redis. Supabase holds data, auth, RLS, Realtime, and atomic SQL.

## Stack

- Next.js App Router + TypeScript (strict)
- Tailwind CSS + Radix primitives
- Supabase (Postgres, anonymous auth, RLS, Realtime)
- Base Pay / USDC on Base
- Cloudflare Turnstile (server-verified)
- Zod validation
- Deploy: Vercel

## Product states

Derived from **server/database time** against `starts_at` / `ends_at` — never from the browser countdown.

| Phase | Rule | Writes |
| --- | --- | --- |
| UPCOMING | `now < starts_at` | Blocked |
| LIVE | `starts_at <= now < ends_at` | Publish + 🔥 |
| FINALIZING | `now >= ends_at` and rankings not yet persisted | Blocked |
| ARCHIVED | `finalized_at` or `archived_at` set | Blocked |

Closing The Wall does **not** depend on a cron job. After `ends_at`, SQL functions and API routes reject writes. Rankings are finalized lazily on the next server request.

## Discovery ranking

Documented in `src/lib/ranking.ts`. Everyone looking at the same Wall sees the same lists. Nothing is personalized.

- **Rising** — `ln(1 + min(V, 40)) × (M / (M + 4)) × (1 / (1 + A / 8)) + 0.25 × ln(1 + min(U, 400)) / (1 + A)`. V = unique 🔥 in the last 60 minutes, M = distinct minutes those 🔥 arrived in, A = hours since publish, U = lifetime unique 🔥. After close, this tab locks to Most 🔥. Burst signals are not part of the score.
- **Most 🔥** — `reaction_count DESC, published_at ASC, public_number ASC`. One tab, not the default.
- **New** — `published_at DESC, public_number DESC`
- **Random** — Uniform draw from public numbers `1..N` not opened in this session, fetched by number. Fullscreen Random Mode: SHOW ME ANOTHER HUMAN. No `ORDER BY random()`.
- **Hidden gems** — at least 3 🔥, drop the top 20% by lifetime 🔥 (or only the loudest if fewer than 5 messages have any 🔥), then `reaction_count / (hours_since_publish + 2)`
- **Final hour** — `published_at` in `[ends_at - 1h, ends_at]`, newest first. The last hour of this Wall, not a rolling clock after close.
- **Message search** — public number, or a phrase.

## Spectator

`/watch` is the free deck (also `/live`). Modes: Auto Wall, Rising Now, Random Human, Top 10. `/watch/stream?mode=rising` is the OBS/browser-source view — no site chrome, countdown and message numbers only, no sound. Add `cycle=12` to rotate, `cycle=0` to hold.

## Local setup

1. Copy `.env.example` to `.env.local`. Leave the Supabase fields blank to use the built-in local Wall. Pay, publish, and certificates run in-process — no chain and no real USDC. Use **Finish this Wall** in the header (or after publish) to seal this day as edition №001 in `/archive`. Fill Supabase fields only when you have a real project.
2. Create a Supabase project.
3. Enable **Anonymous sign-ins** (Authentication → Providers).
4. Apply every file in `supabase/migrations/` in filename order (SQL editor or `supabase db push`).
5. For a live local window, insert one event row (see `DEPLOYMENT.md`). Do not invent sealed editions. The Archive lists only Walls that have actually closed.
6. Insert your admin identity into `admin_users` (or set `ADMIN_EMAILS`) and create that Auth user.
7. Cloudflare Turnstile: dummy keys in `.env.example` always pass and are for development only.
8. `npm install` then `npm test` then `npm run dev`.

### Supabase Realtime

Enable Realtime on `public.public_message_events` only. That table contains public-safe new-message payloads. Individual 🔥 clicks are **not** broadcast globally; aggregates refresh on a short poll.

### Row Level Security

Public clients may read `events`, `event_counters`, `public_messages`, and `public_message_events`.

They must not read payment intents, payments, wallets, ownership tokens, reports, moderation internals, or admin rows. Verification queries: `supabase/tests/rls.sql`.

## Publishing flow

Anonymous session → compose (140 graphemes) → Turnstile (server verify) → moderation preflight → payment intent (expires) → Base Pay 1.00 USDC → server verifies the transaction (never a client `paymentSuccessful` flag) → `publish_paid_message` SQL function assigns the next number atomically.

The same transaction hash cannot publish twice (`UNIQUE` on `payments.transaction_hash` plus a row lock on the intent).

## Certificates

After a successful publish, the owner receives a random token **once**. Only the SHA-256 hash is stored. Certificate routes are `noindex`. Do not log tokens.

## Ads / viral creatives

Generated from live data (never fabricated counts):

`/api/creatives?kind=countdown|milestone|message&ratio=16:9|1:1|9:16&number=4291`

## Deploy

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the exact Vercel + Supabase + Base + Turnstile checklist.

Connect the repo to Vercel. Production uses `BASE_NETWORK=base` (or `base-sepolia` for a public testnet) with a matching `NEXT_PUBLIC_BASE_NETWORK`, a real Turnstile pair, and `NEXT_PUBLIC_SITE_URL=https://YOUR_DOMAIN`. Do not put `SUPABASE_SERVICE_ROLE_KEY` or `TURNSTILE_SECRET_KEY` in `NEXT_PUBLIC_` variables. Event close is `ends_at` in the database — not a cron job.

## Cost posture

Vercel serverless + Supabase + public Base RPC (optional dedicated RPC later) + Turnstile free tier. No Stripe, no always-on Node, no Kubernetes.

## Tests

```bash
npm test
```

Covers event open/close rules, message validation, moderation preflight, payment amount/recipient helpers, duplicate/replay error mapping, certificate hashing, analytics redaction, numbering display, production env contract, and keyboard access on core controls. SQL concurrency and RLS checks live under `supabase/tests/`.
