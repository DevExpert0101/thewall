import { BRAND } from "@/lib/brand";
import type { PublicMessage } from "@/lib/types";
import { pickPublicNumbers } from "@/lib/wall/random";

export type SpectatorLane = "rising" | "fresh" | "quiet" | "surprise";

export const SPECTATOR_LANE_LABEL: Record<SpectatorLane, string> = {
  rising: BRAND.sorts.rising,
  fresh: "Just in",
  quiet: "Quiet",
  surprise: "Wander",
};

/**
 * Structural contrast only. We never read the sentence for mood,
 * identity, or any other trait. Empty lanes are skipped.
 */
export const SPECTATOR_PATTERN: SpectatorLane[] = [
  "rising",
  "fresh",
  "surprise",
  "rising",
  "quiet",
  "rising",
  "fresh",
  "surprise",
  "rising",
];

export type SpectatorCard = PublicMessage & { lane: SpectatorLane };

export function spectatorHourSalt(
  eventId: string,
  nowMs: number,
  frozen = false,
  endsAt?: string,
): string {
  const source = frozen && endsAt ? new Date(endsAt).getTime() : nowMs;
  const hour = Number.isFinite(source) ? Math.floor(source / 3_600_000) : 0;
  return `${eventId}:${hour}`;
}

export function hashSalt(salt: string): number {
  let hash = 2166136261;
  for (let i = 0; i < salt.length; i += 1) {
    hash ^= salt.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function spectatorRng(salt: string): () => number {
  let state = hashSalt(salt) || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickSpectatorWander(input: {
  maxNumber: number;
  exclude?: number[];
  count: number;
  salt: string;
}): number[] {
  return pickPublicNumbers({
    maxNumber: input.maxNumber,
    exclude: input.exclude,
    count: input.count,
    random: spectatorRng(input.salt),
  });
}

function eligible(message: PublicMessage): boolean {
  return !message.isRemoved && message.text.trim().length > 0;
}

/**
 * Interleave public lists so one ranking mood cannot fill the first scroll.
 * Dedupes by id, then public number. Never invents a row.
 */
export function weaveSpectatorFeed(input: {
  rising: PublicMessage[];
  fresh: PublicMessage[];
  quiet: PublicMessage[];
  surprise: PublicMessage[];
  limit?: number;
}): SpectatorCard[] {
  const queues: Record<SpectatorLane, PublicMessage[]> = {
    rising: input.rising.filter(eligible),
    fresh: input.fresh.filter(eligible),
    quiet: input.quiet.filter(eligible),
    surprise: input.surprise.filter(eligible),
  };
  const seen = new Set<string>();
  const seenNumber = new Set<number>();
  const out: SpectatorCard[] = [];
  const cap = Number.isFinite(input.limit) ? Math.max(0, Math.floor(input.limit ?? Infinity)) : Infinity;

  const take = (lane: SpectatorLane): SpectatorCard | null => {
    const queue = queues[lane];
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) return null;
      const key = next.id || `n:${next.publicNumber}`;
      if (seen.has(key) || seenNumber.has(next.publicNumber)) continue;
      seen.add(key);
      seenNumber.add(next.publicNumber);
      return { ...next, lane };
    }
    return null;
  };

  let step = 0;
  let idle = 0;
  while (out.length < cap && idle < SPECTATOR_PATTERN.length) {
    const lane = SPECTATOR_PATTERN[step % SPECTATOR_PATTERN.length];
    step += 1;
    if (!lane) break;
    const card = take(lane);
    if (card) {
      out.push(card);
      idle = 0;
      continue;
    }
    idle += 1;
  }

  while (out.length < cap) {
    const leftover = take("rising") ?? take("fresh") ?? take("quiet") ?? take("surprise");
    if (!leftover) break;
    out.push(leftover);
  }

  return out;
}

export function lanesFromCards(cards: SpectatorCard[]): Record<string, SpectatorLane> {
  return Object.fromEntries(cards.map((card) => [card.id, card.lane]));
}

export function spectatorRankLabel(
  lane: SpectatorLane | undefined,
  sort: string,
  index: number,
  fresh: boolean,
): string | undefined {
  if (fresh) return "Just arrived";
  if (lane === "fresh") return SPECTATOR_LANE_LABEL.fresh;
  if (lane === "quiet") return SPECTATOR_LANE_LABEL.quiet;
  if (lane === "surprise") return SPECTATOR_LANE_LABEL.surprise;
  if (lane === "rising" && index < 3) return SPECTATOR_LANE_LABEL.rising;
  if (!lane && sort === "rising" && index < 3) return BRAND.sorts.rising;
  if (sort === "hot" && index === 0) return BRAND.sorts.hot;
  if (sort === "gems" && index === 0) return "Hidden gem";
  if (sort === "final" && index === 0) return BRAND.sorts.final;
  return undefined;
}
