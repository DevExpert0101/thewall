# Before you publish

Read this before anyone is asked to pay. The deploy steps are in [DEPLOYMENT.md](DEPLOYMENT.md). This page is what to be careful about.

## Do not publish the current local setup

This machine is still in practice mode.

- The treasury is the zero address. A real checkout to that address burns the USDC. It cannot be reversed.
- Practice mode is on. Those publishes do not move money and are not a shared monument.
- Turnstile is the dummy always-pass key.
- Supabase is empty.
- The site URL is `http://localhost:3000`.
- The network is Base Sepolia, not Base mainnet.
- The operator email is still the example address from the template.

A hosted deploy refuses a $1 until those are real. `/api/health` stays not-ok. Copying this environment onto Vercel does not create a live wall.

The local edition on this computer (including “QA Day”) does not upload. Production starts from the event row you insert in Supabase. Do not seed old sentences.

## Money

- Put one real wallet in both `NEXT_PUBLIC_TREASURY_ADDRESS` and `BASE_TREASURY_ADDRESS`. They must match. Do not use the zero address.
- Use `base` on both network settings only when you mean real USDC. `base-sepolia` is test money.
- Leave `NEXT_PUBLIC_SIMULATE_LIVE` unset or `false` in Production. The same for `NEXT_PUBLIC_SIMULATE_ARCHIVE`.
- Do not send people to pay until `https://YOUR_DOMAIN/api/health` reports `"ok": true`.
- The price is always 1.00 USDC. One transaction publishes one sentence. A browser “payment succeeded” flag is not proof.
- If the clock has already hit zero when the payment is checked, the sentence is not published and the transfer is not reversed. A refund is not automatic. Tell people not to pay a second time. They can send you the transaction hash.

## Secrets

- Never put `SUPABASE_SERVICE_ROLE_KEY` or `TURNSTILE_SECRET_KEY` on a `NEXT_PUBLIC_` variable. Those are visible to every visitor.
- Use a live Turnstile pair for the real domain. The dummy keys fail the production check.
- The local steward password works only on localhost. Do not set `ADMIN_LOCAL_ALLOW_DEFAULT` on a public host.
- Production admin access is a real Supabase Auth user listed in `ADMIN_EMAILS` (or `admin_users`). Replace the example email.

## Who paid

There is no name, email, or account.

- The Payments screen shows the message number, `1.00 USDC`, a shortened wallet, and the transaction hash.
- Open that hash on Base to see the full sender address.
- The public wall never shows the wallet.
- The Wall Key proves the visitor wrote the sentence. You cannot look it up, reset it, or turn it back into a person.

## The Wall Key

- The visitor receives the key before they pay. Say so before the day opens. The front page already says: save it; it cannot be recovered; without it they cannot prove the sentence is theirs.
- The key is not in a public URL. Sharing it, or losing it, is how the proof leaves them.
- The Certificate is safe to share. The Ownership Receipt contains the key. Those are different things.

## The day itself

- There is no clock job. The database stops new writing when the end time passes. A browser countdown is not the authority.
- You finish the day by hand in the steward panel. Until you do, the public site stays under review: no winner, no ranks, no archive. The clock hitting zero does not seal the wall by itself.
- During review you can remove a sentence that breaks the rules. The number stays. The public line becomes “Message removed under archive policy.” That can change who is first. You cannot rewrite a file after it is sealed, and you do not add fire by hand.
- A sealed wall does not reopen. The next day is a new edition.

## After it is sealed

- The public record is the downloadable sealed file and its fingerprint. The live site is a working copy.
- Extra copies exist only if you set `ARCHIVE_REPLICA_WEBHOOK_URL` or `ARCHIVE_PROOF_WEBHOOK_URL`. They are optional and are not configured now.
- Set `ERROR_WEBHOOK_URL` if you want failures sent somewhere. Otherwise they exist only in the host logs.
- `/claim` shows the winner only after the wall is finished. Prize contact, payout, and any identity or tax forms happen after the winner proves the Wall Key. An anonymous payout is not promised.

## Check before you announce

1. `/api/health` is `"ok": true`.
2. `/` and `/wall` load on the real domain.
3. A Sepolia test payment publishes one sentence, and the Payments screen finds it by message number and by transaction hash.
4. `/robots.txt` disallows `/admin`, `/certificate`, `/claim`, and `/api/`.
5. You know who finishes the wall, and where a person sends a transaction hash if they paid after zero.
