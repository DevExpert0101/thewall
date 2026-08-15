# Deploy The Wall to Vercel

The Wall is a serverless Next.js app. Data lives in Supabase. Time comes from the database. There is no cron, no always-on Node process, and no local disk.

Closing the event: when `now() >= events.ends_at`, SQL and API routes refuse writes. Rankings persist lazily on the next server request. Do not add a Vercel Cron to “close” The Wall.

## 1. Production build (local check)

```bash
npm install
npm test
npm run db:verify
npm run build
```

`npm run build` must succeed before you connect Vercel. Local builds do not require live secrets. The script uses webpack (`next build --webpack`) so Windows does not hit Turbopack’s `EBUSY` rename on `server-reference-manifest.json`. Vercel runs the same `npm run build`. `next dev` writes to `.next-webpack` so it does not lock the production `.next` folder.

## 2. Supabase (production project)

Use a dedicated production project. Do not reuse local keys.

1. Create the project at [supabase.com](https://supabase.com).
2. Authentication → Providers → enable **Anonymous** sign-ins.
3. Authentication → URL configuration:
   - Site URL = `https://YOUR_DOMAIN` (same as `NEXT_PUBLIC_SITE_URL`)
   - Redirect URLs = `https://YOUR_DOMAIN/**`
4. SQL editor: run every file in `supabase/migrations/` **in filename order** (they are timestamped). Do not run a fictional `0001_init.sql`.
5. Database → Replication / Realtime: enable Realtime only on `public.public_message_events`.
6. Confirm RLS is enabled (migrations already do this). Public clients may read `events`, `event_counters`, `public_messages`, and `public_message_events` only.
7. Insert the 24-hour event row (adjust timestamps in UTC):

```sql
insert into public.events (slug, title, starts_at, ends_at, configuration)
values (
  'the-wall',
  'THE WALL',
  '2026-08-20T00:00:00Z',
  '2026-08-21T00:00:00Z',
  '{"price":"1.00","currency":"USDC","network":"base","maxGraphemes":140}'::jsonb
)
on conflict (slug) do nothing;
```

The counter row and `edition_number` are created by trigger. Do not seed fake messages or invented past editions.

8. Create the operator Auth user (email + password) and either:
   - set `ADMIN_EMAILS` to that email, or
   - insert into `admin_users (auth_user_id, email)`.

Copy from Settings → API:

| Item | Env var |
| --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` (server only) |

## 3. Base network toggle

| Mode | `NEXT_PUBLIC_BASE_NETWORK` | `BASE_NETWORK` | USDC |
| --- | --- | --- | --- |
| Testnet | `base-sepolia` | `base-sepolia` | Sepolia USDC |
| Live | `base` | `base` | Native USDC on Base |

Both variables must match when both are set. Set `NEXT_PUBLIC_TREASURY_ADDRESS` and `BASE_TREASURY_ADDRESS` to the **same** 0x treasury. Do not use the zero address.

Optional: `BASE_RPC_URL` and `BASE_BUNDLER_URL` if public Base RPC rate-limits you.

## 4. Cloudflare Turnstile

1. Create a widget for `YOUR_DOMAIN` (not the dummy always-pass keys).
2. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = site key
3. `TURNSTILE_SECRET_KEY` = secret key

Dummy keys from `.env.example` fail the production contract and `/api/health`.

## 5. Vercel project

1. Import the Git repository in Vercel (Framework Preset: **Next.js**). If this project previously used Vite, open Settings → General and set Framework to Next.js. Clear **Output Directory** — do not use `dist`. The Next.js builder writes `.next`; `vercel.json` pins the framework.
2. Root directory: repository root. No custom server.
3. Add the canonical domain (Production). Preview URLs can stay on `*.vercel.app`.
4. Environment variables — set **Production** (and Preview if you want a Sepolia preview):

### Public (client) — never put secrets here

```
NEXT_PUBLIC_SITE_URL=https://YOUR_DOMAIN
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
NEXT_PUBLIC_EVENT_SLUG=the-wall
NEXT_PUBLIC_BASE_NETWORK=base
NEXT_PUBLIC_TREASURY_ADDRESS=0x...
```

Leave `NEXT_PUBLIC_SIMULATE_LIVE` unset (or `false`) in Production.

### Server only

```
SUPABASE_SERVICE_ROLE_KEY=...
TURNSTILE_SECRET_KEY=...
BASE_TREASURY_ADDRESS=0x...
BASE_NETWORK=base
ADMIN_EMAILS=you@example.com
PAYMENT_INTENT_TTL_SECONDS=900
```

Optional:

```
BASE_RPC_URL=https://...
BASE_BUNDLER_URL=https://...
ERROR_WEBHOOK_URL=https://...
```

5. Deploy Production.
6. After deploy, open:

```
https://YOUR_DOMAIN/api/health
```

Expect `"ok": true`. `HEAD /api/health` returns 200 when ready, 503 otherwise. Checks are `ok` / `missing` / `down` only — no secrets.

7. Confirm:

- `/` and `/wall` load
- `/robots.txt` disallows `/admin`, `/certificate`, `/api/`
- `/sitemap.xml` lists `/`, `/wall`, `/archive`, `/about`
- `/admin/login` is reachable for operators only
- Browser CSP does not block Turnstile, Supabase Realtime, or Base Pay (Coinbase / WalletConnect)

## 6. Canonical domain

`NEXT_PUBLIC_SITE_URL` is the canonical origin (no trailing slash). Metadata, sitemap, robots, Open Graph, and JSON-LD use it. In Vercel → Domains, attach that host to Production. Redirect `www` → apex (or the reverse) in the Vercel domain UI so it matches `NEXT_PUBLIC_SITE_URL`.

## 7. Security headers and CSP

Set in `src/proxy.ts` and `next.config.ts`:

- `Content-Security-Policy` (nonce + `strict-dynamic`)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy`
- `Permissions-Policy`
- `Strict-Transport-Security` on Vercel production

CSP allows: `self`, Cloudflare Turnstile (`challenges.cloudflare.com`), Supabase (`https://*.supabase.co`, `wss://*.supabase.co`), Base RPC, Coinbase, WalletConnect. `object-src 'none'`. `frame-ancestors 'none'`.

Certificate and admin routes are `noindex` and `private, no-store`.

## 8. Error monitoring hooks

- `src/instrumentation.ts` — `register()` logs production env problems when `VERCEL_ENV=production`. It does not throw, so a missing secret cannot 500 every request. `onRequestError` reports server failures. `/api/health` stays reachable and reports `ok: false` until the contract is complete.
- `src/lib/observability/report.ts` — logs a redacted JSON line; POSTs to `ERROR_WEBHOOK_URL` when set.
- `src/app/error.tsx` and `src/app/global-error.tsx` — client boundaries log a digest only (no exception text).

No filesystem logs. No long-running worker.

## 9. What not to add

- Vercel Cron as the close signal
- Redis, a custom WebSocket server, or disk writes under `/tmp` for product state
- `SUPABASE_SERVICE_ROLE_KEY` or `TURNSTILE_SECRET_KEY` on any `NEXT_PUBLIC_*` variable
- Simulation flags on the Production environment

## 10. Preview vs Production

| | Preview | Production |
| --- | --- | --- |
| Network | `base-sepolia` is fine | `base` for real USDC |
| Turnstile | live keys for the preview host, or expect health `ok: false` | live keys required |
| Simulation | optional | forbidden |
| `NEXT_PUBLIC_SITE_URL` | preview URL or canonical | canonical https origin |
