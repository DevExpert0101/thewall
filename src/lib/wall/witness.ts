import { graphemeCount } from "@/lib/message/normalize";
import type { PublicMessage } from "@/lib/types";

/** Long enough to read as a sentence, not a fragment or archival stub. */
export const WITNESS_MIN_GRAPHEMES = 24;
export const WITNESS_LIMIT = 4;

/**
 * Sentences a first visitor can believe are real.
 * Never invents text. Removed rows are dropped. Prefer 🔥, then earlier carve.
 */
export function selectWitnessSentences(
  messages: PublicMessage[],
  limit = WITNESS_LIMIT,
): PublicMessage[] {
  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : WITNESS_LIMIT;
  const eligible = messages.filter(
    (message) => !message.isRemoved && graphemeCount(message.text) >= WITNESS_MIN_GRAPHEMES,
  );
  return [...eligible]
    .sort((a, b) => {
      if (b.reactionCount !== a.reactionCount) return b.reactionCount - a.reactionCount;
      const published = a.publishedAt.localeCompare(b.publishedAt);
      if (published !== 0) return published;
      return a.publicNumber - b.publicNumber;
    })
    .slice(0, cap);
}
