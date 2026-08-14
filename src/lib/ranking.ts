/**
 * Ranking formulas (v1, transparent — no opaque engagement model)
 *
 * New
 *   ORDER BY published_at DESC, public_number DESC
 *
 * Most 🔥 (hot)
 *   ORDER BY reaction_count DESC, published_at ASC, public_number ASC
 *
 * Most 🔥 This Hour (hour)
 *   ORDER BY reactions_last_hour DESC, published_at ASC
 *   reactions_last_hour = COUNT(reactions WHERE created_at >= now() - interval '1 hour')
 *
 * Random
 *   ORDER BY md5(id::text || session_salt)  — stable per request salt, not globally shuffled every render
 *
 * Trending
 *   score = reaction_count / (hours_since_publish + 2) ^ 1.5
 *   hours_since_publish = max(0, (now - published_at) / 3600)
 *   Gravity 1.5 and offset 2 are fixed. Higher 🔥 wins; newer messages get a modest recency boost.
 *   ORDER BY score DESC, published_at DESC
 */
export function hoursSince(publishedAt: Date, now: Date): number {
  return Math.max(0, (now.getTime() - publishedAt.getTime()) / 3_600_000);
}

export function trendingScore(
  reactionCount: number,
  publishedAt: Date,
  now: Date = new Date(),
): number {
  const hours = hoursSince(publishedAt, now);
  return reactionCount / Math.pow(hours + 2, 1.5);
}

export const RANKING_FORMULAS = {
  new: "published_at DESC, public_number DESC",
  hot: "reaction_count DESC, published_at ASC, public_number ASC",
  hour: "reactions in the last 60 minutes DESC, then published_at ASC",
  random: "md5(id || request_salt) — per-request stable shuffle",
  trending: "reaction_count / (hours_since_publish + 2) ^ 1.5",
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

export function assignFinalRanks<
  T extends { reactionCount: number; publishedAt: string; publicNumber: number },
>(messages: T[]): (T & { finalRank: number })[] {
  const order = [...messages].sort(compareHot);
  const rank = new Map(order.map((message, index) => [message.publicNumber, index + 1]));
  return messages.map((message) => ({
    ...message,
    finalRank: rank.get(message.publicNumber) ?? 0,
  }));
}
