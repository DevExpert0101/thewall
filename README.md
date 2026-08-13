# THE WALL

You have 24 hours to leave something behind.

**One dollar. One message. Forever.**

Prototype web app for a single-day live message wall:

- Live wall sorted by 🔥 reactions
- 24-hour countdown (persisted in `localStorage`)
- Floating trending strip
- Simulated $1 paywall to etch (140 chars max)
- Personalized certificate with PNG download / share
- Demo controls: end in 60s, freeze now, new 24h wall

## Run

```bash
npm install
npm run dev
```

## Museum mode

After freeze The Wall dies as a product surface:

**Disabled:** new messages, reactions, edits, deletions, ranking changes  
**Kept:** browse, search, share, certificates, downloads

Post-closure search: result counts + filters (Most reacted, Random, Message number, Trending, Newest, Oldest).

## Final artifact

At zero the app plays a dramatic finale (3–2–1 → THE WALL IS CLOSED → monument screen).

Primary public download: **interactive HTML archive** (read-only, searchable).  
Secondary: **PDF collectible** (print dialog) and **JSON dataset**.

## Certificate

Post-event viral artifact. Shows **both**:

- **Message number** (permanent entry order) — `#42,913`
- **Final rank** (performance when frozen) — `#37`

Also includes date, quote, 🔥 count, voice-of-wall line, unique certificate ID, and a QR to the archived message (`?m=`).

## Trending algorithm

Not raw “most 🔥 = #1” (that rewards early posters).

```
Trending Score =
  reactionVelocity
  × engagementQuality
  × timeAdjustment
  (+ recent burst velocity)
```

A message that catches fire 18 hours in can still climb — better competition across the full day.

## Reactions

Anyone can 🔥 without an account.

Abuse controls (device-local in the prototype; enforce server-side in production):

- One reaction per message per visitor/device  
- Rate limits + cool-offs for bursts  
- Suspicious metronome / bot-like pattern detection  
- Soft human check (pointer activity + occasional math challenge) — never a signup wall


No public accounts. The Wall only shows **Message #** and **Anonymous**.

Never on the public wall: email, name, IP, wallet, tx hash, or device info.

Payment data is stored in a **private ledger** (`the-wall:private-ledger:v1`) for fraud prevention, moderation, refunds, and legal needs — not rendered in the UI.

## Crypto payments

Messages publish **only after** a confirmed on-chain payment:

1. Compose + agree to rules  
2. Wallet pays the treasury (`VITE_TREASURY_ADDRESS`)  
3. App verifies receipt (success, recipient, amount) + confirmations  
4. Then the message is etched (public fields only); payment goes to the private ledger

Copy `.env.example` → `.env.local`. Set `VITE_ALLOW_DEMO_CRYPTO=true` to simulate confirmation without a wallet.
