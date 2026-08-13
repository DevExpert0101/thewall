import {
  AD_HOOKS,
  AD_TAGLINE_STACK,
} from '../lib/previousWalls'
import { MARKETING_LINE, PRODUCT_POSITIONING } from '../lib/positioning'

type AdProps = {
  frozen: boolean
  remainingLabel: string
  voiceCount: number
  onJoin: () => void
  onRead: () => void
}

/**
 * Magnetic advertising billboard — curiosity, belonging, competition, FOMO.
 */
export function AttractAd({
  frozen,
  remainingLabel,
  voiceCount,
  onJoin,
  onRead,
}: AdProps) {
  if (frozen) {
    return (
      <section className="attract-ad attract-ad-archive" aria-label="Archive advertisement">
        <div className="attract-ad-inner">
          <p className="attract-kicker">The artifact lives</p>
          <h2>
            History already happened.
            <br />
            You can still walk through it.
          </h2>
          <p className="attract-body">
            {voiceCount.toLocaleString()} voices froze in place. Browse sealed Walls in the
            archive rail — and wait for the next rare day.
          </p>
          <div className="attract-tag-stack" aria-hidden="true">
            {AD_TAGLINE_STACK.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
          <button type="button" className="btn primary lg" onClick={onRead}>
            Browse archive rail
          </button>
          <p className="attract-line">{MARKETING_LINE}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="attract-ad" aria-label="The Wall advertisement">
      <div className="attract-ad-glow" aria-hidden="true" />
      <div className="attract-ad-inner">
        <p className="attract-kicker">Global · Anonymous · 24 hours</p>
        <h2>
          Write something
          <br />
          the internet can’t delete.
        </h2>
        <p className="attract-body">{PRODUCT_POSITIONING}</p>

        <ul className="attract-hooks">
          {AD_HOOKS.map((h) => (
            <li key={h.kicker}>
              <strong>{h.kicker}</strong>
              <span>{h.line}</span>
            </li>
          ))}
        </ul>

        <div className="attract-urgency">
          <span>{remainingLabel} left</span>
          <span>{voiceCount.toLocaleString()} voices already etched</span>
        </div>

        <div className="attract-tag-stack" aria-hidden="true">
          {AD_TAGLINE_STACK.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>

        <div className="attract-cta">
          <button type="button" className="btn primary lg" onClick={onJoin}>
            Etch your place in history — $1
          </button>
          <button type="button" className="btn ghost lg" onClick={onRead}>
            First, see what people are writing
          </button>
        </div>
        <p className="attract-line">{MARKETING_LINE}</p>
      </div>
    </section>
  )
}
