/**
 * Turnstile / CAPTCHA token handling.
 * Production: verify token with Cloudflare siteverify on the server — never trust the client alone.
 */

const TOKEN_KEY = 'the-wall:turnstile-session:v1'
const TOKEN_TTL_MS = 4 * 60_000

export type TurnstileSession = {
  token: string
  issuedAt: number
  mode: 'turnstile' | 'demo'
}

export function turnstileSiteKey(): string | null {
  const key = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim()
  return key || null
}

/** Cloudflare always-passes test key — useful when wiring the widget without a real site. */
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'

export function loadTurnstileSession(): TurnstileSession | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TurnstileSession
    if (!parsed.token || !parsed.issuedAt) return null
    if (Date.now() - parsed.issuedAt > TOKEN_TTL_MS) {
      sessionStorage.removeItem(TOKEN_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveTurnstileSession(session: TurnstileSession): void {
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(session))
}

export function clearTurnstileSession(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}

export function issueDemoTurnstileToken(): TurnstileSession {
  const session: TurnstileSession = {
    token: `demo_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
    issuedAt: Date.now(),
    mode: 'demo',
  }
  saveTurnstileSession(session)
  return session
}

/**
 * Client-side acceptance for the prototype.
 * Swap for POST /cdn-cgi/challenge-platform or your API siteverify.
 */
export function verifyTurnstileToken(token: string | null | undefined): boolean {
  if (!token) return false
  const session = loadTurnstileSession()
  if (!session || session.token !== token) return false
  if (Date.now() - session.issuedAt > TOKEN_TTL_MS) {
    clearTurnstileSession()
    return false
  }
  return true
}

export function getValidTurnstileToken(): string | null {
  const session = loadTurnstileSession()
  if (!session) return null
  if (!verifyTurnstileToken(session.token)) return null
  return session.token
}
