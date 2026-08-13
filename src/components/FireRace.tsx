import type { WallMessage } from '../types'
import { formatFire, formatMessageNumber } from '../lib/format'
import { Countdown } from './Countdown'

type Props = {
  first: WallMessage
  second: WallMessage | null
  frozen: boolean
  remainingMs: number
  onChase: () => void
  onKnockOff: () => void
  onShare: (message: WallMessage) => void
  onReact: (id: string) => void
  reacted: boolean
}

export function FireRace({
  first,
  second,
  frozen,
  remainingMs,
  onChase,
  onKnockOff,
  onShare,
  onReact,
  reacted,
}: Props) {
  const gap = second ? Math.max(0, first.reactions - second.reactions) : null

  return (
    <section className="fire-race" aria-label="Fire race for number one">
      <div className="fire-race-clock">
        <Countdown remainingMs={remainingMs} frozen={frozen} compact showMantra />
      </div>
      <p className="fire-race-kicker">
        {frozen ? 'Competition · Final #1' : 'Competition · Can you reach #1?'}
      </p>
      <p className="fire-race-serial">{formatMessageNumber(first.number)}</p>
      <blockquote className="fire-race-quote">“{first.text}”</blockquote>
      <p className="fire-race-count">{formatFire(first.reactions)} 🔥</p>

      {second && gap !== null && !frozen && (
        <div className="fire-race-gap">
          <span className="fire-race-arrow" aria-hidden="true">
            ↓
          </span>
          <p>
            #2 is only <strong>{gap.toLocaleString()} 🔥</strong> behind
          </p>
          <p className="fire-race-second">
            {formatMessageNumber(second.number)} · {formatFire(second.reactions)} 🔥
          </p>
        </div>
      )}

      {frozen ? (
        <p className="fire-race-cta">This #1 is locked forever.</p>
      ) : (
        <p className="fire-race-cta">Can you reach #1?</p>
      )}

      <div className="fire-race-actions">
        {!frozen && (
          <button
            type="button"
            className={`fire-btn on-stage ${reacted ? 'on' : ''}`}
            disabled={reacted}
            onClick={() => onReact(first.id)}
          >
            <span aria-hidden="true">🔥</span>
            <span>{reacted ? 'Reacted' : 'Boost #1'}</span>
          </button>
        )}
        {!frozen && (
          <button type="button" className="btn primary" onClick={onKnockOff}>
            Reach #1 — post yours
          </button>
        )}
        {!frozen && second && (
          <button type="button" className="btn ghost" onClick={onChase}>
            Chase the lead
          </button>
        )}
        <button type="button" className="btn ghost" onClick={() => onShare(first)}>
          Share #1
        </button>
      </div>
    </section>
  )
}
