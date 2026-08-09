#!/usr/bin/env node
// Simulate other people on The Wall: inserts live messages from anonymous
// voices plus confirmed payments (with real-looking tx hashes), so the wall
// feels populated and the artifact freeze has content.
//
// Usage: npm run simulate [count]
// Requires a LIVE wall. If the wall has frozen, run `npx supabase db reset`.

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const COIN = process.env.COIN ?? "BTC";
const AMOUNT = (1 / parseFloat(process.env.COIN_PRICE_USD ?? "60000")).toFixed(8);
const ADDRESS = process.env.DEMO_ADDRESS ?? "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
const CONFIRMATIONS = parseInt(process.env.SIMULATED_CONFIRM_SECONDS ?? "6", 10);

const randomTxHash = () =>
  Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) =>
  Math.floor(min + Math.random() * (max - min + 1));

const VOICES = [
  "my therapist says i should say it out loud. so here i am",
  "i called my mom this morning. for no reason. first time in a decade",
  "to the girl reading this at 3am: you are going to be okay",
  "i forgave him today. not for him. for me",
  "sold my car, bought a one-way ticket. no clue where it lands",
  "my dad asked me to teach him tiktok. cutest thing ever",
  "the internet is loud. this wall is louder. i don't know why i feel lighter",
  "been sober 214 days. this is the first thing i ever confessed publicly",
  "i told my boss i'm done. walked out. legs still shaking",
  "grandma died monday. she told me to 'say the thing'. so here's the thing: i love you all",
  "nobody claps for the night shift workers. i see you",
  "i rewrote my code for the fifth time tonight and honestly? it still won't run",
  "started a garden. three seeds came up. i named them all and cried",
  "my brother says i'm not funny. this is my revenge",
  "quitting social media for a month. the wall is my last words",
  "paid $1 to tell a stranger: thank you for holding the door that one time",
  "i miss the person i was before the algorithm",
  "first day of the rest of my life starts tomorrow. maybe today. definitely not monday",
  "if you're reading this from your phone under your desk, i see you too",
  "i wrote a poem about a lighthouse. it's about my therapist",
  "to whoever returns my wallet: your coffee's on me, forever",
  "my cat judged my outfit today. worse, she was right",
  "i didn't cry at the funeral. i cried in the parking lot. that counts",
  "learned to say no this year. best upgrade since wifi",
  "i'm rooting for you, stranger. that's the whole message",
  "she said maybe. i've been riding that maybe for three years",
  "the wall asked me to be honest. i'm not ready yet. but this is close",
  "one small sentence for a wall, one giant receipt for me",
  "i paid with bitcoin because my bank asked why i wanted $1 in cash",
  "my kids think the wall is a video game. technically they're not wrong",
  "today's to-do list: 1) exist 2) see the wall 3) maybe be brave",
  "i was told to whisper, so i whispered loud enough for a city",
];

const supabase = createClient(URL, SERVICE_KEY);

async function main() {
  const count = Math.max(1, Math.min(500, parseInt(process.argv[2] ?? process.env.SIMULATED_SEED_COUNT ?? "24", 10)));

  const { data: walls } = await supabase
    .from("walls")
    .select("id, created_at, ends_at, frozen")
    .order("created_at", { ascending: false })
    .limit(20);
  const candidates = Array.isArray(walls) ? walls : [];
  const wall =
    candidates.find((w) => !w.frozen && new Date(w.ends_at).getTime() > Date.now()) ??
    candidates.find((w) => !w.frozen);

  if (!wall) {
    console.error("No live wall found. Start one first (the reset button).");
    process.exit(1);
  }

  const wallStart = new Date(wall.created_at).getTime();
  const wallEnd = new Date(wall.ends_at).getTime();
  const now = Date.now();

  const created = [];
  for (let i = 0; i < count; i++) {
    const t = wallStart + Math.random() * Math.max(1, now - wallStart);
    created.push(t);
  }
  created.sort((a, b) => a - b);

  let live = 0;
  let highest = 0;
  let sampleHash = null;

  for (let i = 0; i < count; i++) {
    const content = pick(VOICES);
    const reactions = Math.random() < 0.12 ? randInt(6, 18) : randInt(0, 4);

    const { data: msg, error: mErr } = await supabase
      .from("messages")
      .insert({
        wall_id: wall.id,
        content,
        reactions,
        status: "live",
        created_at: new Date(created[i]).toISOString(),
      })
      .select("id, message_number")
      .single();

    if (mErr || !msg) {
      console.error("  message insert failed:", mErr?.message);
      continue;
    }

    const txHash = randomTxHash();
    const { error: pErr } = await supabase.from("payments").insert({
      message_id: msg.id,
      address: ADDRESS,
      amount: AMOUNT,
      coin: COIN,
      tx_hash: txHash,
      status: "confirmed",
      confirmations: CONFIRMATIONS,
      confirmed_at: new Date(created[i]).toISOString(),
    });

    if (pErr) {
      console.error("  payment insert failed:", pErr.message);
    } else if (sampleHash === null) {
      sampleHash = txHash;
    }

    live++;
    if (reactions > highest) highest = reactions;
  }

  const remaining = Math.max(0, Math.round((wallEnd - Date.now()) / 60000));
  console.log(`Seeded ${live}/${count} messages from other people.`);
  console.log(`Wall: ${live} live voices, highest trending ${highest} 🔥.`);
  console.log(`Time left on the wall: ~${remaining} minute(s).`);
  if (sampleHash) {
    console.log(`Sample tx for verification: https://mempool.space/tx/${sampleHash}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
