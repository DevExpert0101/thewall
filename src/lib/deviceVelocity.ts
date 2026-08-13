/**
 * Device / session velocity — prototype stand-in for IP + device fingerprinting.
 * Production: edge computes IP/ASN hash + device signals server-side.
 */

const VELOCITY_KEY = 'the-wall:device-velocity:v1'

export type VelocityEventKind = 'publish' | 'payment_attempt' | 'react' | 'captcha_fail'

type VelocityState = {
  deviceId: string
  events: { kind: VelocityEventKind; at: number; meta?: string }[]
  captchaFails: number
  lockedUntil: number
}

const WINDOW_MS = 60 * 60 * 1000
const DAY_MS = 24 * WINDOW_MS

/** Soft caps — cheap $1 surface needs tight publish limits */
const MAX_PUBLISH_PER_HOUR = 3
const MAX_PUBLISH_PER_DAY = 8
const MIN_PUBLISH_GAP_MS = 45_000
const MAX_PAYMENT_ATTEMPTS_PER_HOUR = 8
const MAX_REACT_PER_MINUTE = 20
const MAX_CAPTCHA_FAILS = 5
const LOCKOUT_MS = 15 * 60_000

function uid(): string {
  return `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

function load(): VelocityState {
  try {
    const raw = localStorage.getItem(VELOCITY_KEY)
    if (!raw) {
      const fresh: VelocityState = {
        deviceId: uid(),
        events: [],
        captchaFails: 0,
        lockedUntil: 0,
      }
      localStorage.setItem(VELOCITY_KEY, JSON.stringify(fresh))
      return fresh
    }
    const parsed = JSON.parse(raw) as VelocityState
    return {
      deviceId: parsed.deviceId || uid(),
      events: Array.isArray(parsed.events) ? parsed.events : [],
      captchaFails: parsed.captchaFails ?? 0,
      lockedUntil: parsed.lockedUntil ?? 0,
    }
  } catch {
    return { deviceId: uid(), events: [], captchaFails: 0, lockedUntil: 0 }
  }
}

function save(state: VelocityState): void {
  localStorage.setItem(VELOCITY_KEY, JSON.stringify(state))
}

function prune(state: VelocityState, now: number): VelocityState {
  return {
    ...state,
    events: state.events.filter((e) => now - e.at < DAY_MS),
  }
}

export function getDeviceId(): string {
  return load().deviceId
}

/** Read-only snapshot for admin traffic / suspicious panels. */
export function loadDeviceVelocitySnapshot() {
  return load()
}

export function clearDeviceVelocity(): void {
  localStorage.removeItem(VELOCITY_KEY)
}

export type VelocityDeny = {
  ok: false
  reason: string
  retryAfterMs?: number
}

export type VelocityAllow = { ok: true; deviceId: string }

export function assertNotLocked(): VelocityAllow | VelocityDeny {
  const state = load()
  const now = Date.now()
  if (now < state.lockedUntil) {
    return {
      ok: false,
      reason: 'This device is temporarily locked after unusual activity.',
      retryAfterMs: state.lockedUntil - now,
    }
  }
  return { ok: true, deviceId: state.deviceId }
}

export function recordVelocity(kind: VelocityEventKind, meta?: string): void {
  const now = Date.now()
  let state = prune(load(), now)
  state.events.push({ kind, at: now, meta })
  if (kind === 'captcha_fail') {
    state.captchaFails += 1
    if (state.captchaFails >= MAX_CAPTCHA_FAILS) {
      state.lockedUntil = now + LOCKOUT_MS
      state.captchaFails = 0
    }
  }
  if (kind === 'publish' || kind === 'react') {
    state.captchaFails = Math.max(0, state.captchaFails - 1)
  }
  save(state)
}

export function evaluatePublishVelocity(): VelocityAllow | VelocityDeny {
  const locked = assertNotLocked()
  if (!locked.ok) return locked

  const now = Date.now()
  const state = prune(load(), now)
  const publishes = state.events.filter((e) => e.kind === 'publish')
  const last = publishes[publishes.length - 1]
  if (last && now - last.at < MIN_PUBLISH_GAP_MS) {
    return {
      ok: false,
      reason: 'Publish rate limit — wait before etching another message.',
      retryAfterMs: MIN_PUBLISH_GAP_MS - (now - last.at),
    }
  }
  const hour = publishes.filter((e) => now - e.at < WINDOW_MS).length
  if (hour >= MAX_PUBLISH_PER_HOUR) {
    return {
      ok: false,
      reason: `Device velocity limit: max ${MAX_PUBLISH_PER_HOUR} messages per hour.`,
      retryAfterMs: WINDOW_MS,
    }
  }
  if (publishes.length >= MAX_PUBLISH_PER_DAY) {
    return {
      ok: false,
      reason: `Device velocity limit: max ${MAX_PUBLISH_PER_DAY} messages per day.`,
      retryAfterMs: DAY_MS,
    }
  }
  return { ok: true, deviceId: state.deviceId }
}

export function evaluatePaymentAttemptVelocity(): VelocityAllow | VelocityDeny {
  const locked = assertNotLocked()
  if (!locked.ok) return locked
  const now = Date.now()
  const state = prune(load(), now)
  const attempts = state.events.filter(
    (e) => e.kind === 'payment_attempt' && now - e.at < WINDOW_MS,
  ).length
  if (attempts >= MAX_PAYMENT_ATTEMPTS_PER_HOUR) {
    return {
      ok: false,
      reason: 'Too many payment attempts from this device. Try again later.',
      retryAfterMs: WINDOW_MS,
    }
  }
  return { ok: true, deviceId: state.deviceId }
}

export function evaluateReactVelocity(): VelocityAllow | VelocityDeny {
  const locked = assertNotLocked()
  if (!locked.ok) return locked
  const now = Date.now()
  const state = prune(load(), now)
  const minute = state.events.filter(
    (e) => e.kind === 'react' && now - e.at < 60_000,
  ).length
  if (minute >= MAX_REACT_PER_MINUTE) {
    return {
      ok: false,
      reason: 'Reaction velocity limit — this device is moving too fast.',
      retryAfterMs: 60_000,
    }
  }
  return { ok: true, deviceId: state.deviceId }
}
