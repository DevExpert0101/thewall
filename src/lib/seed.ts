import type { SupabaseClient } from "@supabase/supabase-js";

export const VOICES = [
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

function randomTxHash(): string {
  const hex = "0123456789abcdef";
  return Array.from({ length: 64 }, () => hex[Math.floor(Math.random() * 16)]).join("");
}

export interface SeedResult {
  seeded: number;
  trending: number;
}

export async function seedVoices(
  sb: SupabaseClient,
  wallId: string,
  count = 0,
): Promise<SeedResult> {
  const target = Math.min(
    500,
    Math.max(1, count || parseInt(process.env.SIMULATED_SEED_COUNT ?? "24", 10)),
  );
  const address =
    process.env.DEMO_ADDRESS ?? "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
  const amount = (1 / Math.max(parseFloat(process.env.COIN_PRICE_USD ?? "60000"), 1)).toFixed(8);
  const coin = process.env.COIN ?? "BTC";
  const confirmations = parseInt(process.env.SIMULATED_CONFIRM_SECONDS ?? "6", 10);

  const { data: wall } = await sb
    .from("walls")
    .select("created_at")
    .eq("id", wallId)
    .single();
  const wallStart = new Date(wall?.created_at ?? Date.now()).getTime();
  const now = Date.now();

  let seeded = 0;
  let trending = 0;

  for (let i = 0; i < target; i++) {
    const content = VOICES[Math.floor(Math.random() * VOICES.length)];
    const reactions =
      Math.random() < 0.12
        ? 6 + Math.floor(Math.random() * 13)
        : Math.floor(Math.random() * 5);
    const created = new Date(
      wallStart + Math.random() * Math.max(1, now - wallStart),
    ).toISOString();

    const { data: msg, error: mErr } = await sb
      .from("messages")
      .insert({
        wall_id: wallId,
        content,
        reactions,
        status: "live",
        moderation_status: "approved",
        created_at: created,
      })
      .select("id")
      .single();
    if (mErr || !msg) continue;

    await sb.from("payments").insert({
      message_id: msg.id,
      address,
      amount,
      coin,
      tx_hash: randomTxHash(),
      status: "confirmed",
      confirmations,
      confirmed_at: created,
    });

    seeded++;
    if (reactions > trending) trending = reactions;
  }

  return { seeded, trending };
}
