/** Final-hour urgency stages — never soft, never quiet. */

export type FinalHourStage = 'calm' | 'hour' | 'ten' | 'voices' | 'sixty'

export const FINAL_HOUR_MS = 60 * 60_000
export const FINAL_TEN_MS = 10 * 60_000
export const FINAL_VOICES_MS = 5 * 60_000
export const FINAL_SIXTY_MS = 60_000

export function finalHourStage(remainingMs: number, frozen: boolean): FinalHourStage {
  if (frozen || remainingMs <= 0) return 'calm'
  if (remainingMs <= FINAL_SIXTY_MS) return 'sixty'
  if (remainingMs <= FINAL_VOICES_MS) return 'voices'
  if (remainingMs <= FINAL_TEN_MS) return 'ten'
  if (remainingMs <= FINAL_HOUR_MS) return 'hour'
  return 'calm'
}

export function finalHourHeadline(
  stage: FinalHourStage,
  messageCount: number,
): string | null {
  switch (stage) {
    case 'hour':
      return '1 HOUR LEFT'
    case 'ten':
      return '10 MINUTES LEFT'
    case 'voices':
      return `${messageCount.toLocaleString()} MESSAGES`
    case 'sixty':
      return 'THE WALL CLOSES IN 60 SECONDS'
    default:
      return null
  }
}

export const PRODUCT_POSITIONING =
  'The Wall is a 24-hour anonymous global time capsule. For $1, you get 140 characters and a permanent place in history. When the clock reaches zero, the Wall closes forever.'

export const MARKETING_LINE = 'One dollar. One message. One day. Forever.'

export const EDITION_STRATEGY = [
  {
    title: 'The Wall — 2026',
    note: 'One event. Scarcity is the brand.',
  },
  {
    title: 'The Wall — 2027',
    note: 'A year later — not a daily app.',
  },
  {
    title: 'Special editions',
    note: "New Year's Day · Election Day · Humanity — rare, not routine.",
  },
] as const
