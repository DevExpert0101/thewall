/**
 * Account-free reaction abuse controls (device-local for the prototype).
 * Production should re-enforce these server-side with IP/ASN heuristics —
 * never require a public account just to 🔥.
 */

const GUARD_KEY = 'the-wall:reaction-guard:v1'

/** Min gap between two reactions from the same device */
const MIN_GAP_MS = 650
/** Sliding window caps */
const WINDOW_1M_MS = 60_000
const MAX_PER_MINUTE = 25
const WINDOW_10M_MS = 10 * 60_000
const MAX_PER_10_MIN = 120
/** Temporary cool-off after suspicious bursts */
const COOLDOWN_MS = 45_000
/** Require a recent real pointer/key/touch before counting a 🔥 */
const HUMAN_SIGNAL_MAX_AGE_MS = 90_000
/** Clicks that fire instantly after a signal look automated */
const MIN_SIGNAL_TO_CLICK_MS = 90
const MAX_STRIKES_BEFORE_CHALLENGE = 2

export type ReactDenyReason =
  | 'frozen'
  | 'already_reacted'
  | 'rate_limited'
  | 'cooldown'
  | 'bot_check'
  | 'challenge_required'

export type ReactGuardResult =
  | { ok: true }
  | { ok: false; reason: ReactDenyReason; message: string; retryAfterMs?: number }

type GuardState = {
  timestamps: number[]
  cooldownUntil: number
  strikes: number
  lastHumanSignalAt: number
  challengeUntilSolved: boolean
  /** Simple rotating challenge answer (sum of two small ints) */
  challengeA: number
  challengeB: number
}

function defaultGuard(): GuardState {
  return {
    timestamps: [],
    cooldownUntil: 0,
    strikes: 0,
    lastHumanSignalAt: 0,
    challengeUntilSolved: false,
    challengeA: 0,
    challengeB: 0,
  }
}

function loadGuard(): GuardState {
  try {
    const raw = localStorage.getItem(GUARD_KEY)
    if (!raw) return defaultGuard()
    const parsed = JSON.parse(raw) as Partial<GuardState>
    return { ...defaultGuard(), ...parsed, timestamps: parsed.timestamps ?? [] }
  } catch {
    return defaultGuard()
  }
}

function saveGuard(state: GuardState): void {
  localStorage.setItem(GUARD_KEY, JSON.stringify(state))
}

function prune(timestamps: number[], now: number): number[] {
  return timestamps.filter((t) => now - t < WINDOW_10M_MS)
}

function issueChallenge(state: GuardState): GuardState {
  return {
    ...state,
    challengeUntilSolved: true,
    challengeA: 2 + Math.floor(Math.random() * 7),
    challengeB: 2 + Math.floor(Math.random() * 7),
  }
}

/** Call from global pointer/key/touch listeners — proves a person is at the device. */
let lastSignalWrite = 0
export function noteHumanSignal(event?: Event): void {
  const target = event?.target
  if (target instanceof Element && target.closest('.fire-btn, .react-challenge, .react-toast')) {
    return
  }
  const now = Date.now()
  // Throttle storage writes (mousemove is chatty)
  if (event?.type === 'mousemove' && now - lastSignalWrite < 400) return
  lastSignalWrite = now
  const state = loadGuard()
  state.lastHumanSignalAt = now
  saveGuard(state)
}

export function getReactionChallenge(): { a: number; b: number } | null {
  const state = loadGuard()
  if (!state.challengeUntilSolved) return null
  return { a: state.challengeA, b: state.challengeB }
}

export function solveReactionChallenge(answer: number): boolean {
  const state = loadGuard()
  if (!state.challengeUntilSolved) return true
  const ok = answer === state.challengeA + state.challengeB
  if (ok) {
    state.challengeUntilSolved = false
    state.strikes = 0
    state.cooldownUntil = 0
    state.lastHumanSignalAt = Date.now()
    saveGuard(state)
  }
  return ok
}

export function clearReactionGuard(): void {
  localStorage.removeItem(GUARD_KEY)
}

/**
 * Evaluate whether this device may add one 🔥 to `messageId`.
 * Does not mutate reactedIds — caller owns that list.
 */
export function evaluateReaction(opts: {
  messageId: string
  reactedIds: string[]
  frozen: boolean
}): ReactGuardResult {
  if (opts.frozen) {
    return { ok: false, reason: 'frozen', message: 'The Wall is frozen — reactions are locked.' }
  }
  if (opts.reactedIds.includes(opts.messageId)) {
    return {
      ok: false,
      reason: 'already_reacted',
      message: 'You already reacted to this message on this device.',
    }
  }

  const now = Date.now()
  let state = loadGuard()
  state.timestamps = prune(state.timestamps, now)

  if (state.challengeUntilSolved) {
    return {
      ok: false,
      reason: 'challenge_required',
      message: 'Quick check — solve the puzzle to keep reacting (no account needed).',
    }
  }

  if (now < state.cooldownUntil) {
    return {
      ok: false,
      reason: 'cooldown',
      message: 'Slow down — temporary cool-off after unusual reaction speed.',
      retryAfterMs: state.cooldownUntil - now,
    }
  }

  const sinceHuman = now - state.lastHumanSignalAt
  if (!state.lastHumanSignalAt || sinceHuman > HUMAN_SIGNAL_MAX_AGE_MS) {
    state.strikes += 1
    if (state.strikes >= MAX_STRIKES_BEFORE_CHALLENGE) state = issueChallenge(state)
    saveGuard(state)
    return {
      ok: false,
      reason: 'bot_check',
      message: 'Move your mouse or tap the screen once, then try 🔥 again.',
    }
  }
  if (sinceHuman < MIN_SIGNAL_TO_CLICK_MS) {
    state.strikes += 1
    if (state.strikes >= MAX_STRIKES_BEFORE_CHALLENGE) state = issueChallenge(state)
    else {
      state.cooldownUntil = now + 8_000
    }
    saveGuard(state)
    return {
      ok: false,
      reason: 'bot_check',
      message: 'That reaction looked automated. Wait a moment and try again.',
      retryAfterMs: 8_000,
    }
  }

  const last = state.timestamps[state.timestamps.length - 1]
  if (last && now - last < MIN_GAP_MS) {
    state.strikes += 1
    if (state.strikes >= MAX_STRIKES_BEFORE_CHALLENGE) {
      state = issueChallenge(state)
      saveGuard(state)
      return {
        ok: false,
        reason: 'challenge_required',
        message: 'Too fast — confirm you’re human to keep reacting.',
      }
    }
    saveGuard(state)
    return {
      ok: false,
      reason: 'rate_limited',
      message: 'Easy — one 🔥 at a time.',
      retryAfterMs: MIN_GAP_MS - (now - last),
    }
  }

  const lastMinute = state.timestamps.filter((t) => now - t < WINDOW_1M_MS).length
  if (lastMinute >= MAX_PER_MINUTE) {
    state.cooldownUntil = now + COOLDOWN_MS
    state.strikes += 1
    if (state.strikes >= MAX_STRIKES_BEFORE_CHALLENGE) state = issueChallenge(state)
    saveGuard(state)
    return {
      ok: false,
      reason: 'rate_limited',
      message: 'Rate limit hit. Take a breath — no account needed, just pacing.',
      retryAfterMs: COOLDOWN_MS,
    }
  }

  const last10 = state.timestamps.length
  if (last10 >= MAX_PER_10_MIN) {
    state.cooldownUntil = now + COOLDOWN_MS * 2
    state = issueChallenge(state)
    saveGuard(state)
    return {
      ok: false,
      reason: 'challenge_required',
      message: 'Unusual volume from this device. Pass a quick check to continue.',
      retryAfterMs: COOLDOWN_MS * 2,
    }
  }

  // Pattern: near-perfect metronome intervals → suspicious
  if (state.timestamps.length >= 5) {
    const gaps: number[] = []
    for (let i = 1; i < state.timestamps.length; i++) {
      gaps.push(state.timestamps[i] - state.timestamps[i - 1])
    }
    const recent = gaps.slice(-5)
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length
    const variance =
      recent.reduce((a, b) => a + (b - avg) ** 2, 0) / recent.length
    if (avg < 1200 && variance < 40_000) {
      state.strikes += 1
      state.cooldownUntil = now + COOLDOWN_MS
      if (state.strikes >= MAX_STRIKES_BEFORE_CHALLENGE) state = issueChallenge(state)
      saveGuard(state)
      return {
        ok: false,
        reason: 'cooldown',
        message: 'Suspicious reaction pattern detected. Cool-off started.',
        retryAfterMs: COOLDOWN_MS,
      }
    }
  }

  state.timestamps.push(now)
  state.strikes = Math.max(0, state.strikes - 1)
  saveGuard(state)
  return { ok: true }
}

export const REACT_COPY = {
  already_reacted: 'Already 🔥’d on this device',
  hint: 'One 🔥 per message per device. No account required.',
} as const
