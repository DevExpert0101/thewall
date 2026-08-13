/**
 * Server-side ranking authority (prototype).
 *
 * Client UI never invents competitive rank from raw local 🔥 alone.
 * Reactions that affect TRENDING must carry a verified receipt.
 * Production: receipts issued by your API after auth + Turnstile + rate limits.
 */

import type { WallMessage } from '../types'
import { trendingBreakdown } from './trending'
import { getDeviceId } from './deviceVelocity'

const RECEIPT_KEY = 'the-wall:reaction-receipts:v1'

export type ReactionReceipt = {
  id: string
  messageId: string
  deviceId: string
  issuedAt: number
  /** HMAC-like prototype signature */
  sig: string
}

function rankingSecret(): string {
  return (
    (import.meta.env.VITE_RANKING_SECRET as string | undefined)?.trim() ||
    'wall-ranking-prototype-secret'
  )
}

/** Cheap stable signature for the prototype — replace with KMS HMAC server-side. */
export function signReceiptPayload(
  messageId: string,
  deviceId: string,
  issuedAt: number,
): string {
  const body = `${messageId}|${deviceId}|${issuedAt}|${rankingSecret()}`
  let h = 2166136261
  for (let i = 0; i < body.length; i++) {
    h ^= body.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `r${(h >>> 0).toString(16)}`
}

function loadReceipts(): ReactionReceipt[] {
  try {
    const raw = localStorage.getItem(RECEIPT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ReactionReceipt[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveReceipts(list: ReactionReceipt[]): void {
  localStorage.setItem(RECEIPT_KEY, JSON.stringify(list))
}

export function clearReactionReceipts(): void {
  localStorage.removeItem(RECEIPT_KEY)
}

export function verifyReceipt(r: ReactionReceipt): boolean {
  if (!r.messageId || !r.deviceId || !r.issuedAt || !r.sig) return false
  return r.sig === signReceiptPayload(r.messageId, r.deviceId, r.issuedAt)
}

export function hasReceiptForDevice(messageId: string, deviceId = getDeviceId()): boolean {
  return loadReceipts().some(
    (r) => r.messageId === messageId && r.deviceId === deviceId && verifyReceipt(r),
  )
}

export function issueReactionReceipt(messageId: string): ReactionReceipt {
  const deviceId = getDeviceId()
  if (hasReceiptForDevice(messageId, deviceId)) {
    throw new Error('Duplicate reaction receipt for this device.')
  }
  const issuedAt = Date.now()
  const receipt: ReactionReceipt = {
    id: `rcpt_${issuedAt.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    messageId,
    deviceId,
    issuedAt,
    sig: signReceiptPayload(messageId, deviceId, issuedAt),
  }
  saveReceipts([receipt, ...loadReceipts()])
  return receipt
}

/** Count only verified receipts — the authority’s reaction tally. */
export function trustedReactionCount(messageId: string): number {
  return loadReceipts().filter((r) => r.messageId === messageId && verifyReceipt(r)).length
}

/**
 * Effective reactions for ranking:
 * - seed_* keep genesis counts (simulated live wall)
 * - user messages use receipt-backed trust only
 */
export function authoritativeReactions(message: WallMessage): number {
  if (message.id.startsWith('seed_')) return message.reactions
  return trustedReactionCount(message.id)
}

export function authoritativeTrendingScore(message: WallMessage, now: number): number {
  const trusted: WallMessage = {
    ...message,
    reactions: authoritativeReactions(message),
  }
  return trendingBreakdown(trusted, now).score
}

export function sortByAuthoritativeTrending(
  messages: WallMessage[],
  now: number,
): WallMessage[] {
  return [...messages].sort((a, b) => {
    const diff = authoritativeTrendingScore(b, now) - authoritativeTrendingScore(a, now)
    if (diff !== 0) return diff
    const reactDiff = authoritativeReactions(b) - authoritativeReactions(a)
    if (reactDiff !== 0) return reactDiff
    return b.number - a.number
  })
}
