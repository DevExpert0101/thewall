/**
 * Recent reaction timestamps for burst velocity in trending.
 * Operational only — not shown on the public wall.
 */

const PULSE_KEY = 'the-wall:reaction-pulse:v1'
const MAX_PER_MESSAGE = 80

type PulseMap = Record<string, number[]>

function load(): PulseMap {
  try {
    const raw = localStorage.getItem(PULSE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as PulseMap
  } catch {
    return {}
  }
}

function save(map: PulseMap): void {
  localStorage.setItem(PULSE_KEY, JSON.stringify(map))
}

export function recordReactionPulse(messageId: string, at = Date.now()): void {
  const map = load()
  const next = [...(map[messageId] ?? []), at].slice(-MAX_PER_MESSAGE)
  map[messageId] = next
  save(map)
}

export function recentReactionCount(
  messageId: string,
  now: number,
  windowMs: number,
): number {
  const stamps = load()[messageId]
  if (!stamps?.length) return 0
  return stamps.filter((t) => now - t <= windowMs).length
}

/** Aggregate pulses across all messages — admin traffic monitor. */
export function totalReactionPulsesInWindow(now: number, windowMs: number): number {
  const map = load()
  let total = 0
  for (const stamps of Object.values(map)) {
    total += stamps.filter((t) => now - t <= windowMs).length
  }
  return total
}

export function clearReactionPulses(): void {
  localStorage.removeItem(PULSE_KEY)
}

/** Seed / demo helper — synthesize a recent burst so late messages can demo-climb. */
export function seedPulseBurst(messageId: string, count: number, now = Date.now()): void {
  const map = load()
  const stamps = map[messageId] ?? []
  for (let i = 0; i < count; i++) {
    stamps.push(now - Math.floor(Math.random() * 12 * 60_000))
  }
  map[messageId] = stamps.slice(-MAX_PER_MESSAGE)
  save(map)
}
