import { useEffect, useRef, useState } from 'react'
import { recordVelocity } from '../lib/deviceVelocity'
import {
  TURNSTILE_TEST_SITE_KEY,
  issueDemoTurnstileToken,
  saveTurnstileSession,
  turnstileSiteKey,
  type TurnstileSession,
} from '../lib/turnstile'

type Props = {
  onVerified: (session: TurnstileSession) => void
  onExpired?: () => void
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string
          callback: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
        },
      ) => string
      remove: (id: string) => void
    }
  }
}

/**
 * Cloudflare Turnstile when VITE_TURNSTILE_SITE_KEY is set;
 * otherwise a local demo human-check (prototype only).
 */
export function TurnstileGate({ onVerified, onExpired }: Props) {
  const siteKey = turnstileSiteKey()
  const hostRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const onVerifiedRef = useRef(onVerified)
  const onExpiredRef = useRef(onExpired)
  const [demoChecked, setDemoChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onVerifiedRef.current = onVerified
    onExpiredRef.current = onExpired
  }, [onVerified, onExpired])

  useEffect(() => {
    if (!siteKey || !hostRef.current) return
    let cancelled = false

    function mount() {
      if (cancelled || !hostRef.current || !window.turnstile) return
      if (widgetId.current) {
        try {
          window.turnstile.remove(widgetId.current)
        } catch {
          /* ignore */
        }
      }
      widgetId.current = window.turnstile.render(hostRef.current, {
        sitekey: siteKey || TURNSTILE_TEST_SITE_KEY,
        theme: 'light',
        callback: (token) => {
          const session: TurnstileSession = {
            token,
            issuedAt: Date.now(),
            mode: 'turnstile',
          }
          saveTurnstileSession(session)
          setError(null)
          onVerifiedRef.current(session)
        },
        'expired-callback': () => {
          onExpiredRef.current?.()
        },
        'error-callback': () => {
          recordVelocity('captcha_fail')
          setError('Turnstile failed. Retry the challenge.')
        },
      })
    }

    const existing = document.querySelector(
      'script[data-wall-turnstile="1"]',
    ) as HTMLScriptElement | null

    if (window.turnstile) {
      mount()
    } else if (existing) {
      existing.addEventListener('load', mount)
    } else {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.dataset.wallTurnstile = '1'
      script.addEventListener('load', mount)
      script.addEventListener('error', () => {
        recordVelocity('captcha_fail')
        setError('Could not load Turnstile. Check network / ad blockers.')
      })
      document.head.appendChild(script)
    }

    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current)
        } catch {
          /* ignore */
        }
      }
    }
  }, [siteKey])

  if (!siteKey) {
    return (
      <div className="turnstile-gate demo">
        <p className="turnstile-label">Human check (demo)</p>
        <label className="turnstile-demo">
          <input
            type="checkbox"
            checked={demoChecked}
            onChange={(e) => {
              const on = e.target.checked
              setDemoChecked(on)
              if (on) {
                const session = issueDemoTurnstileToken()
                setError(null)
                onVerifiedRef.current(session)
              } else {
                onExpiredRef.current?.()
              }
            }}
          />
          <span>I’m human — continue to payment</span>
        </label>
        <p className="turnstile-fine">
          Set <code>VITE_TURNSTILE_SITE_KEY</code> for Cloudflare Turnstile.
        </p>
        {error && <p className="pay-error">{error}</p>}
      </div>
    )
  }

  return (
    <div className="turnstile-gate">
      <p className="turnstile-label">CAPTCHA / Turnstile</p>
      <div ref={hostRef} className="turnstile-host" />
      {error && <p className="pay-error">{error}</p>}
    </div>
  )
}
