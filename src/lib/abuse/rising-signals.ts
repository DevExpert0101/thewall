/**
 * Anti-manipulation signals for Rising. These are not weights in the public
 * score. Operators can read them; the wall order does not.
 *
 * Public Rising uses only V, M, U, and A — see src/lib/ranking.ts.
 */
export const BURST_MIN_FIRES = 8;
export const BURST_PER_MINUTE = 6;
export const YOUNG_BURST_HOURS = 3 / 60;
export const YOUNG_BURST_FIRES = 10;
export const LOW_SPREAD_FIRES = 10;
export const LOW_SPREAD_MINUTES = 2;

export type RisingSignalInput = {
  hourCount: number;
  hourMinutes: number;
  hoursSincePublish: number;
};

export type RisingSignals = {
  burstRatio: number;
  burst: boolean;
  youngBurst: boolean;
  lowSpread: boolean;
};

function finiteNonNeg(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
}

export function risingSignals(input: RisingSignalInput): RisingSignals {
  const hourCount = finiteNonNeg(input.hourCount);
  const hourMinutes = Math.max(finiteNonNeg(input.hourMinutes), hourCount > 0 ? 1 : 0);
  const age = finiteNonNeg(input.hoursSincePublish);
  const burstRatio = hourMinutes > 0 ? hourCount / hourMinutes : 0;
  return {
    burstRatio,
    burst: hourCount >= BURST_MIN_FIRES && burstRatio >= BURST_PER_MINUTE,
    youngBurst: age < YOUNG_BURST_HOURS && hourCount >= YOUNG_BURST_FIRES,
    lowSpread: hourCount >= LOW_SPREAD_FIRES && hourMinutes <= LOW_SPREAD_MINUTES,
  };
}
