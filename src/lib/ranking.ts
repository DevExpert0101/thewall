/**
 * Discovery ranking (transparent — the same lists for every visitor)
 *
 * Rising (also the "trending" alias)
 *   One 🔥 per visitor per sentence, so unique reactors = reaction rows.
 *
 *   V = unique 🔥 in the last 60 minutes
 *   M = distinct UTC minutes those 🔥 arrived in (1..60)
 *   U = lifetime unique 🔥
 *   A = hours since published, floored at 0
 *
 *   V* = min(V, 40)
 *   U* = min(U, 400)
 *
 *   score = ln(1 + V*) × (M / (M + 4)) × (1 / (1 + A / 8))
 *         + 0.25 × ln(1 + U*) / (1 + A)
 *
 *   Why not velocity × freshness + engagement as a raw product/sum:
 *   - ln(1 + x) stops a 200-🔥 pile from producing an extreme number
 *   - M / (M + 4) is a public spread term: 80 🔥 in one minute score like a
 *     thin burst, not like an hour of attention
 *   - lifetime U is a small decaying term so a brand-new sentence can beat
 *     a five-hour monument that is only still collecting a drip
 *   - caps and a final score clamp keep the number in [0, 8]
 *
 *   ORDER BY score DESC, published_at DESC, public_number DESC
 *   After close, Rising locks to Most 🔥 so a rolling hour cannot drift.
 *
 *   Anti-manipulation signals live in src/lib/abuse/rising-signals.ts.
 *   They do not change this score.
 *
 * Most 🔥 / The Victor
 *   ORDER BY reaction_count DESC, published_at ASC, public_number ASC
 *   The all-time leaderboard. It is one tab, never the default.
 *   At Finish, removed sentences are dropped from this order. Rank #1 is
 *   the next living inscription. After seal, those ranks do not move.
 *   Ties are deterministic: earlier published inscription, then lower
 *   inscription number. No randomness.
 *
 * New
 *   ORDER BY published_at DESC, public_number DESC
 *
 * Random
 *   Uniform draw from public numbers 1..N not yet opened in this session.
 *   Fetch by (event_id, public_number). Never ORDER BY random() on the table.
 *
 * Hidden gems
 *   1. Ignore messages with fewer than 3 🔥.
 *   2. Ignore the top 20% of messages by lifetime 🔥 (already exposed).
 *      If fewer than 5 messages have any 🔥, only the single loudest is dropped.
 *   3. Rank the rest by reaction_count / (hours_since_publish + 2),
 *      then published_at DESC.
 *
 * Final hour
 *   published_at >= ends_at - 60 minutes AND published_at <= ends_at
 *   ORDER BY published_at DESC, public_number DESC
 *   The last hour of this Wall, not a rolling clock after close.
 *
 * Aliases: trending and hour resolve to rising.
 * Nothing is personalized. No viewer history, no paid boosts, no wallet weight.
 */
export function hoursSince(publishedAt: Date, now: Date): number {
  const ms = now.getTime() - publishedAt.getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, ms / 3_600_000);
}

export const RISING_WINDOW_MS = 60 * 60 * 1000;
export const RISING_FRESH_HOURS = 8;
export const RISING_SPREAD_OFFSET = 4;
export const RISING_ENGAGEMENT_WEIGHT = 0.25;
export const RISING_VELOCITY_CAP = 40;
export const RISING_UNIQUE_CAP = 400;
export const RISING_SCORE_CAP = 8;

export const RISING_FORMULA =
  "ln(1 + min(V, 40)) × (M / (M + 4)) × (1 / (1 + A / 8)) + 0.25 × ln(1 + min(U, 400)) / (1 + A)";
export const RISING_FORMULA_VARS =
  "V = unique 🔥 in the last 60 minutes; M = distinct minutes those 🔥 arrived in; A = hours since publish (≥ 0); U = lifetime unique 🔥. One 🔥 per visitor per sentence.";

export const GEM_MIN_FIRES = 3;
export const GEM_FAMOUS_FRACTION = 0.2;
export const GEM_AGE_OFFSET_HOURS = 2;

export type RisingInput = {
  hourCount: number;
  hourMinutes: number;
  reactionCount: number;
  publishedAt: Date;
  now?: Date;
};

function clampNonNeg(value: number, cap = Number.POSITIVE_INFINITY): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, cap);
}

export function risingMinutes(hourCount: number, hourMinutes: number): number {
  const velocity = clampNonNeg(hourCount, RISING_VELOCITY_CAP);
  const minutes = clampNonNeg(hourMinutes, 60);
  if (velocity > 0 && minutes < 1) return 1;
  return minutes;
}

export function risingParts(input: RisingInput): {
  velocity: number;
  spread: number;
  freshness: number;
  engagement: number;
  score: number;
} {
  const now = input.now ?? new Date();
  const age = hoursSince(input.publishedAt, now);
  const vStar = clampNonNeg(input.hourCount, RISING_VELOCITY_CAP);
  const uStar = clampNonNeg(input.reactionCount, RISING_UNIQUE_CAP);
  const minutes = risingMinutes(input.hourCount, input.hourMinutes);
  const velocity = Math.log(1 + vStar);
  const spread = minutes / (minutes + RISING_SPREAD_OFFSET);
  const freshness = 1 / (1 + age / RISING_FRESH_HOURS);
  const engagement = Math.log(1 + uStar) / (1 + age);
  const raw = velocity * spread * freshness + RISING_ENGAGEMENT_WEIGHT * engagement;
  const score = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), RISING_SCORE_CAP) : 0;
  return { velocity, spread, freshness, engagement, score };
}

export function risingScore(input: RisingInput): number {
  return risingParts(input).score;
}

export function compareRising(
  a: Omit<RisingInput, "publishedAt" | "now"> & { publishedAt: Date | string; publicNumber: number },
  b: Omit<RisingInput, "publishedAt" | "now"> & { publishedAt: Date | string; publicNumber: number },
  now?: Date,
): number {
  const publishedA = a.publishedAt instanceof Date ? a.publishedAt : new Date(a.publishedAt);
  const publishedB = b.publishedAt instanceof Date ? b.publishedAt : new Date(b.publishedAt);
  const score =
    risingScore({ ...b, publishedAt: publishedB, now }) -
    risingScore({ ...a, publishedAt: publishedA, now });
  if (score) return score;
  const published = publishedB.toISOString().localeCompare(publishedA.toISOString());
  return published || b.publicNumber - a.publicNumber;
}

export function gemScore(
  reactionCount: number,
  publishedAt: Date,
  now: Date = new Date(),
): number {
  return reactionCount / (hoursSince(publishedAt, now) + GEM_AGE_OFFSET_HOURS);
}

export function hiddenGemCutoff(counts: number[]): number | null {
  const withFire = counts.filter((count) => count >= 1).sort((a, b) => b - a);
  if (withFire.length === 0) return null;
  if (withFire.length < 5) return withFire[0] ?? null;
  const famousCount = Math.max(1, Math.floor(withFire.length * GEM_FAMOUS_FRACTION));
  return withFire[famousCount - 1] ?? null;
}

export function isHiddenGem(reactionCount: number, cutoff: number | null): boolean {
  if (reactionCount < GEM_MIN_FIRES) return false;
  if (cutoff == null) return true;
  return reactionCount < cutoff;
}

export function selectHiddenGems<
  T extends { reactionCount: number; publishedAt: string },
>(messages: T[], now: Date): T[] {
  const cutoff = hiddenGemCutoff(messages.map((message) => message.reactionCount));
  return messages
    .filter((message) => isHiddenGem(message.reactionCount, cutoff))
    .sort((a, b) => {
      const score =
        gemScore(b.reactionCount, new Date(b.publishedAt), now) -
        gemScore(a.reactionCount, new Date(a.publishedAt), now);
      return score || b.publishedAt.localeCompare(a.publishedAt);
    });
}

export function finalHourStart(endsAt: string): string {
  return new Date(Date.parse(endsAt) - RISING_WINDOW_MS).toISOString();
}

export function inFinalHour(publishedAt: string, endsAt: string): boolean {
  const published = Date.parse(publishedAt);
  const end = Date.parse(endsAt);
  if (!Number.isFinite(published) || !Number.isFinite(end)) return false;
  return published >= end - RISING_WINDOW_MS && published <= end;
}

export const RANKING_FORMULAS = {
  rising: RISING_FORMULA,
  hot: "reaction_count DESC, published_at ASC, public_number ASC",
  new: "published_at DESC, public_number DESC",
  random: "uniform public_number in 1..N excluding this session’s opened numbers; index lookup",
  gems: "≥3 🔥, drop top 20% by lifetime 🔥, then 🔥 / (hours + 2)",
  final: "published_at in [ends_at - 1h, ends_at], newest first",
  hour: "alias of rising",
  trending: "alias of rising",
} as const;

/** Same order as finalize_event_rankings: 🔥 DESC, published_at ASC, number ASC. */
export function compareHot(
  a: { reactionCount: number; publishedAt: string; publicNumber: number },
  b: { reactionCount: number; publishedAt: string; publicNumber: number },
): number {
  return (
    b.reactionCount - a.reactionCount ||
    a.publishedAt.localeCompare(b.publishedAt) ||
    a.publicNumber - b.publicNumber
  );
}

export function isLivingForVictor<T extends { isRemoved?: boolean }>(message: T): boolean {
  return message.isRemoved !== true;
}

export function assignFinalRanks<
  T extends { reactionCount: number; publishedAt: string; publicNumber: number; isRemoved?: boolean },
>(messages: T[]): (T & { finalRank: number | null })[] {
  const order = messages.filter(isLivingForVictor).sort(compareHot);
  const rank = new Map(order.map((message, index) => [message.publicNumber, index + 1]));
  return messages.map((message) => ({
    ...message,
    finalRank: rank.get(message.publicNumber) ?? null,
  }));
}
