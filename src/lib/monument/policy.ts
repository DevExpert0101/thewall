/**
 * Official Victor tie policy.
 *
 * Same historical data must always produce the same #1. No randomness.
 *
 * 1. Highest final 🔥 among living sentences
 * 2. Earlier published inscription
 * 3. Lower inscription number
 *
 * A sentence removed before Finish is dropped from this order. After seal,
 * ranks and the carved Victor do not move; a later removal only redacts.
 *
 * "Reached that count first" is not a stored field. Earlier published_at is
 * the durable proxy and matches finalize_event_rankings / compareHot.
 */
export const VICTOR_TIE_POLICY =
  "Highest 🔥 among living sentences, then earlier published inscription, then lower inscription number. Removed before Finish is skipped.";

export function winningMargin(winnerReactions: number, secondReactions: number | null | undefined): number {
  return Math.max(0, winnerReactions - (secondReactions ?? 0));
}

export function parseMonumentCapacity(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}
