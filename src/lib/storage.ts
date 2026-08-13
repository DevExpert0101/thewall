import type { ViewerState, WallMessage, WallState } from '../types'
import { SEED_TEXTS } from '../data/seed'
import { clearPrivateLedger } from './privateLedger'
import { clearModerationOps } from './moderationOps'
import { clearDeviceVelocity } from './deviceVelocity'
import { clearPaymentFraud } from './paymentFraud'
import { clearReactionReceipts, sortByAuthoritativeTrending } from './rankingAuthority'
import { clearTurnstileSession } from './turnstile'

const WALL_KEY = 'the-wall:v2'
const VIEWER_KEY = 'the-wall:viewer:v1'
export const WALL_DURATION_MS = 24 * 60 * 60 * 1000

/** Each wall edition starts at #000001 */
export const SEED_MESSAGE_START = 1
export const SEED_VIEWER_BASE = 1_203_421

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

/** Strip any legacy identity/payment fields from public messages. */
export function toPublicMessage(raw: Partial<WallMessage> & Record<string, unknown>): WallMessage {
  return {
    id: String(raw.id),
    text: String(raw.text ?? ''),
    createdAt: Number(raw.createdAt) || Date.now(),
    reactions: Number(raw.reactions) || 0,
    number: Number(raw.number) || 0,
  }
}

export function getOrCreateViewer(): ViewerState {
  const raw = localStorage.getItem(VIEWER_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ViewerState & { hasPaid?: boolean }
      return {
        viewerKey: parsed.viewerKey || uid('viewer'),
        myMessageIds: Array.isArray(parsed.myMessageIds) ? parsed.myMessageIds : [],
        reactedIds: Array.isArray(parsed.reactedIds) ? parsed.reactedIds : [],
        countedAsViewer: parsed.countedAsViewer ?? false,
      }
    } catch {
      /* fall through */
    }
  }
  const viewer: ViewerState = {
    viewerKey: uid('viewer'),
    myMessageIds: [],
    reactedIds: [],
    countedAsViewer: false,
  }
  localStorage.setItem(VIEWER_KEY, JSON.stringify(viewer))
  return viewer
}

export function saveViewer(viewer: ViewerState): void {
  const safe: ViewerState = {
    viewerKey: viewer.viewerKey,
    myMessageIds: viewer.myMessageIds,
    reactedIds: viewer.reactedIds,
    countedAsViewer: viewer.countedAsViewer,
  }
  localStorage.setItem(VIEWER_KEY, JSON.stringify(safe))
}

function buildSeedMessages(startedAt: number): WallMessage[] {
  return SEED_TEXTS.map((text, i) => ({
    id: `seed_${i}`,
    text,
    createdAt: startedAt + i * 37_000,
    reactions: Math.floor(Math.pow(Math.random(), 2) * 4200) + (i % 7 === 0 ? 800 : 12),
    number: SEED_MESSAGE_START + i,
  }))
}

/** Snapshot final trending order — museum ranks never move again. */
export function lockFinalRanking(state: WallState): WallState {
  if (state.finalRankingIds?.length) return state
  const ranked = sortByAuthoritativeTrending(state.messages, state.endsAt)
  return { ...state, finalRankingIds: ranked.map((m) => m.id) }
}

function migrateWall(state: WallState & Record<string, unknown>): WallState {
  const messages = (state.messages ?? []).map((m) =>
    toPublicMessage(m as Partial<WallMessage> & Record<string, unknown>),
  )
  let next: WallState = {
    startedAt: state.startedAt,
    endsAt: state.endsAt,
    frozen: Boolean(state.frozen),
    messages,
    nextNumber: state.nextNumber,
    viewerCount:
      typeof state.viewerCount === 'number' ? state.viewerCount : SEED_VIEWER_BASE,
    finalRankingIds: Array.isArray(state.finalRankingIds)
      ? (state.finalRankingIds as string[])
      : undefined,
    submissionsPaused: Boolean(state.submissionsPaused),
  }
  if (next.frozen) next = lockFinalRanking(next)
  return next
}

export function loadWall(): WallState {
  const raw = localStorage.getItem(WALL_KEY)
  if (raw) {
    try {
      let state = migrateWall(JSON.parse(raw) as WallState & Record<string, unknown>)
      if (Date.now() >= state.endsAt) {
        state = lockFinalRanking({ ...state, frozen: true })
      }
      saveWall(state)
      return state
    } catch {
      /* fall through */
    }
  }

  const startedAt = Date.now()
  const messages = buildSeedMessages(startedAt)
  const state: WallState = {
    startedAt,
    endsAt: startedAt + WALL_DURATION_MS,
    frozen: false,
    messages,
    nextNumber: SEED_MESSAGE_START + messages.length,
    viewerCount: SEED_VIEWER_BASE,
  }
  localStorage.setItem(WALL_KEY, JSON.stringify(state))
  return state
}

export function saveWall(state: WallState): void {
  const publicOnly: WallState = {
    startedAt: state.startedAt,
    endsAt: state.endsAt,
    frozen: state.frozen,
    messages: state.messages.map((m) => toPublicMessage(m)),
    nextNumber: state.nextNumber,
    viewerCount: state.viewerCount,
    finalRankingIds: state.finalRankingIds,
    submissionsPaused: Boolean(state.submissionsPaused),
  }
  localStorage.setItem(WALL_KEY, JSON.stringify(publicOnly))
}

export function resetWall(): WallState {
  localStorage.removeItem(WALL_KEY)
  clearPrivateLedger()
  clearModerationOps()
  clearDeviceVelocity()
  clearPaymentFraud()
  clearReactionReceipts()
  clearTurnstileSession()
  return loadWall()
}

/** Demo helper: jump to last N minutes before freeze */
export function setWallEndingIn(ms: number): WallState {
  let state = loadWall()
  const now = Date.now()
  state.endsAt = now + ms
  state.frozen = ms <= 0
  if (state.frozen) {
    state.endsAt = now
    state = lockFinalRanking(state)
  }
  saveWall(state)
  return state
}
