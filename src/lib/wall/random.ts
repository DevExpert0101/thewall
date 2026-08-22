/**
 * Random Mode draws from the public-number urn.
 *
 *   1. Public numbers are 1..N (assigned atomically).
 *   2. Pick uniformly among numbers not opened in this session.
 *   3. Fetch those rows by (event_id, public_number) — index lookup.
 *
 * Never ORDER BY random() on the message table. Never hash-sort a large page.
 * Session “seen” is an explicit walk through the capsule, not hidden profiling.
 */

export const SHOW_ANOTHER_HUMAN = "SHOW ME ANOTHER HUMAN";
export const RANDOM_EXCLUDE_MAX = 48;
export const RANDOM_PREFETCH = 2;
export const RANDOM_SEEN_KEY = "thewall:random-seen";

export function randomSeenKey(eventId: string): string {
  return `${RANDOM_SEEN_KEY}:${eventId}`;
}

export function parseExclude(raw: string | undefined): number[] {
  if (!raw) return [];
  const seen = new Set<number>();
  for (const part of raw.split(",")) {
    const n = Number.parseInt(part.trim(), 10);
    if (!Number.isInteger(n) || n < 1 || n > 99_999_999 || seen.has(n)) continue;
    seen.add(n);
    if (seen.size >= RANDOM_EXCLUDE_MAX) break;
  }
  return [...seen];
}

export function formatExclude(numbers: number[]): string {
  return [...new Set(numbers.filter((n) => Number.isInteger(n) && n >= 1))]
    .slice(0, RANDOM_EXCLUDE_MAX)
    .join(",");
}

function randomUnit(random: () => number): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value >= 1) return 0.999999;
  return value;
}

export function pickPublicNumbers(input: {
  maxNumber: number;
  exclude?: number[];
  count: number;
  random?: () => number;
}): number[] {
  const max = Math.floor(input.maxNumber);
  const want = Math.min(Math.max(Math.floor(input.count), 0), RANDOM_EXCLUDE_MAX);
  if (max < 1 || want < 1) return [];

  const blocked = new Set(
    (input.exclude ?? []).filter((n) => Number.isInteger(n) && n >= 1 && n <= max),
  );
  const available = max - blocked.size;
  if (available <= 0) return [];

  const take = Math.min(want, available);
  const roll = input.random ?? Math.random;

  if (available <= 64) {
    const pool: number[] = [];
    for (let n = 1; n <= max; n += 1) {
      if (!blocked.has(n)) pool.push(n);
    }
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(randomUnit(roll) * (i + 1));
      const current = pool[i];
      const swap = pool[j];
      if (current === undefined || swap === undefined) continue;
      pool[i] = swap;
      pool[j] = current;
    }
    return pool.slice(0, take);
  }

  const picked = new Set<number>();
  let guard = 0;
  const budget = take * 16 + 8;
  while (picked.size < take && guard < budget) {
    guard += 1;
    const n = 1 + Math.floor(randomUnit(roll) * max);
    if (!blocked.has(n)) picked.add(n);
  }
  return [...picked];
}

export function readSeenNumbers(eventId: string): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(randomSeenKey(eventId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parseExclude(parsed.join(","));
  } catch {
    return [];
  }
}

export function writeSeenNumbers(eventId: string, numbers: number[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      randomSeenKey(eventId),
      JSON.stringify(parseExclude(numbers.join(","))),
    );
  } catch {
    // private mode / quota — walk still works for this page load
  }
}

export function clearSeenNumbers(eventId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(randomSeenKey(eventId));
  } catch {
    // ignore
  }
}
