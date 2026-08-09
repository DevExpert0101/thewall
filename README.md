# The Wall

> One wall. One day. One permanent record of humanity's voice.

Pay $1, leave an anonymous 140-character message on a massive live wall.
Anyone in the world watches for free. Messages compete for 🔥 reactions;
the most-reacted messages float to the top in real time. After exactly
5 minutes (dev setting — see Schema) the wall freezes forever and is
published as a downloadable artifact — and every participant gets a
certificate showing where their message sits in history.

## Stack

- **Next.js 16** (App Router, React 19, Tailwind v4)
- **Supabase** (Postgres + Realtime) — local via the Supabase CLI/Docker
- **Crypto checkout** (simulated on-chain flow) — fake tx broadcast + confirmations

## What works

- Live wall with real-time inserts + reaction updates (Supabase Realtime)
- 🔥 reactions, one per viewer (deduped anonymously via a device id)
- Trending messages float to the top with a FLIP animation
- 24-hour countdown; the wall freezes at zero
- Crypto checkout: QR + address + amount, simulated broadcast, polling for confirmations (~6s), then your message goes live
- Personalized certificate (`/certificate/[id]`) + shareable card (`/card/[id]`), both downloadable as PNG via canvas
- Frozen wall → downloadable artifact (`/api/artifact`) + final ranked standings

## Run it

Requirements: Node 20+, Docker.

```bash
npm install

# 1. Start local Supabase (applies migrations in supabase/migrations/)
npx supabase start

# 2. Copy the generated keys into .env.local
npx supabase status   # grab the Publishable (anon) and Secret (service) keys

# 3. Run the app
npm run dev
```

Open http://localhost:3000.

`.env.local` values (for local dev):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<secret key>
COIN=BTC
COIN_PRICE_USD=60000          # $1 = 0.00001667 BTC
DEMO_ADDRESS=bc1q...          # demo receive address shown in checkout
SIMULATED_CONFIRM_SECONDS=6   # fake blockchain confirmation time
```

## Testing the freeze

The wall runs from when migrations are applied until `walls.ends_at`
(currently 5 minutes — edit the seed in
`supabase/migrations/20260808000000_init.sql` to change it). To force the
freeze so you can see the artifact/certificate/frozen UI:

```bash
npm run endwall
```

To get a fresh 5-minute wall (also wipes test messages):

```bash
npx supabase db reset
```

To populate the wall with simulated messages "from other people" (each with
a confirmed payment + tx hash so the wall and frozen artifact have content):

```bash
npm run simulate          # 24 voices
npm run simulate 40       # custom count
```

## Payment flow (prototype)

`POST /api/checkout` reserves your message and creates a fake payment
(address/amount/QR). `POST /api/payment-confirm` simulates broadcasting a
transaction and assigns each payment a unique 64-char **tx hash**;
`GET /api/payment-status` simulates confirmations (one per second) and
publishes the message once they elapse.

Every payment gets a verifiable record:

- **tx hash** — shown in the checkout UI (copyable) while confirming and after
  confirmation, with a "Verify on the block explorer" link
  (`https://mempool.space/tx/<hash>` for BTC).
- **`GET /api/payment-verify?txHash=…`** — public endpoint; looks up any
  payment by its tx hash and returns its status, confirmations, amount,
  address and explorer link. `verified: true` once confirmed.

Swap these routes for a real crypto provider (Coinbase Commerce, a chain's
mempool, etc.) when you go to production — the tx hash + explorer link +
verification endpoint map directly onto a real chain.

## Schema

- `walls` — singleton; `ends_at` = `created_at + 5 minutes` (edit seed), `frozen` latch
- `messages` — `message_number` (global seq), `content` (≤140), `reactions`, `status` (`pending` → `live`)
- `payments` — checkout + simulated tx state
- `reactions` — dedupes one 🔥 per anonymous device per message

Mutations go through `public.react()` and `public.confirm_payment()` security-definer
functions so counts stay race-free. RLS keeps only `live` messages readable by
anonymous viewers (which is also what Realtime broadcasts).

## Deploy note

For a real run you'd point this at a hosted Supabase project (same schema
works via `supabase db push`) and wire a real payment provider. The app is a
tombstone after day one — no ongoing costs.
