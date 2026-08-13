import type { WallMessage } from '../types'
import { recentReactionCount } from './reactionPulse'

/**
 * Velocity-based trending — not raw 🔥 totals.
 *
 * Trending Score =
 *   reactionVelocity
 *   × engagementQuality
 *   × timeAdjustment
 *
 * Early posts lose their free lead; a message that explodes at hour 18 can still win.
 */

const MIN_AGE_HOURS = 1 / 12 // 5 minutes — avoids infinite velocity on brand-new posts
const GRAVITY = 1.28
/** Weight for reactions in the last 20 minutes (true burst velocity) */
const BURST_WEIGHT = 4.2
const BURST_WINDOW_MS = 20 * 60 * 1000

export type TrendingBreakdown = {
  score: number
  reactionVelocity: number
  engagementQuality: number
  timeAdjustment: number
  burstVelocity: number
}

export function ageHours(createdAt: number, now: number): number {
  return Math.max(MIN_AGE_HOURS, (now - createdAt) / 3_600_000)
}

/**
 * Lifetime velocity: 🔥 per hour of life on the wall.
 */
export function reactionVelocity(reactions: number, createdAt: number, now: number): number {
  return reactions / ageHours(createdAt, now)
}

/**
 * Engagement quality — log dampens pure snowball from early raw counts,
 * while still rewarding real traction.
 */
export function engagementQuality(reactions: number): number {
  return Math.log2(reactions + 1)
}

/**
 * Time adjustment — gravity curve. Older messages need ongoing velocity to stay on top.
 * (ageHours + 2)^−gravity
 */
export function timeAdjustment(createdAt: number, now: number): number {
  const age = ageHours(createdAt, now)
  return Math.pow(2 / (age + 2), GRAVITY)
}

/**
 * Recent burst velocity — reactions in the last ~20m, annualized-ish per hour.
 * Lets an 18-hour-old message spike into #1.
 */
export function burstVelocity(messageId: string, now: number): number {
  const recent = recentReactionCount(messageId, now, BURST_WINDOW_MS)
  const windowHours = BURST_WINDOW_MS / 3_600_000
  return (recent / windowHours) * BURST_WEIGHT
}

export function trendingBreakdown(
  message: WallMessage,
  now: number,
): TrendingBreakdown {
  const velocity = reactionVelocity(message.reactions, message.createdAt, now)
  const burst = burstVelocity(message.id, now)
  const combinedVelocity = velocity + burst
  const quality = engagementQuality(message.reactions)
  const time = timeAdjustment(message.createdAt, now)
  const score = combinedVelocity * quality * time

  return {
    score,
    reactionVelocity: velocity,
    engagementQuality: quality,
    timeAdjustment: time,
    burstVelocity: burst,
  }
}

export function trendingScore(message: WallMessage, now: number): number {
  return trendingBreakdown(message, now).score
}

export function sortByTrending(messages: WallMessage[], now: number): WallMessage[] {
  return [...messages].sort((a, b) => {
    const diff = trendingScore(b, now) - trendingScore(a, now)
    if (diff !== 0) return diff
    // Tie-break: higher recent burst, then newer number
    const burstDiff = burstVelocity(b.id, now) - burstVelocity(a.id, now)
    if (burstDiff !== 0) return burstDiff
    return b.number - a.number
  })
}
