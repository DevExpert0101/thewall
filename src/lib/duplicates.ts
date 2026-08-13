import type { WallMessage } from '../types'

/** Normalize for near-duplicate comparison */
export function normalizeMessageText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenSet(text: string): Set<string> {
  return new Set(normalizeMessageText(text).split(' ').filter((t) => t.length > 1))
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let inter = 0
  for (const t of a) if (b.has(t)) inter += 1
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

export type DuplicateHit = {
  message: WallMessage
  similarity: number
  exact: boolean
}

/**
 * Reject spam clones — exact match or high token overlap with recent wall messages.
 */
export function findDuplicateMessage(
  text: string,
  messages: WallMessage[],
  opts: { lookback?: number; threshold?: number } = {},
): DuplicateHit | null {
  const lookback = opts.lookback ?? 400
  const threshold = opts.threshold ?? 0.82
  const norm = normalizeMessageText(text)
  if (!norm) return null
  const tokens = tokenSet(text)
  const pool = messages.slice(0, lookback)

  for (const message of pool) {
    const other = normalizeMessageText(message.text)
    if (!other) continue
    if (other === norm) {
      return { message, similarity: 1, exact: true }
    }
    const sim = jaccard(tokens, tokenSet(message.text))
    if (sim >= threshold && norm.length >= 12) {
      return { message, similarity: sim, exact: false }
    }
  }
  return null
}

export function assertNotDuplicate(
  text: string,
  messages: WallMessage[],
): { ok: true } | { ok: false; reason: string } {
  const hit = findDuplicateMessage(text, messages)
  if (!hit) return { ok: true }
  if (hit.exact) {
    return {
      ok: false,
      reason: `Duplicate detection: identical text already on The Wall (${formatNum(hit.message.number)}).`,
    }
  }
  return {
    ok: false,
    reason: `Duplicate detection: too similar to ${formatNum(hit.message.number)} (${Math.round(hit.similarity * 100)}% match).`,
  }
}

function formatNum(n: number): string {
  return `#${String(n).padStart(6, '0')}`
}
