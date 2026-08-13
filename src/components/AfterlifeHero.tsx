import { MARKETING_LINE, PRODUCT_POSITIONING } from '../lib/positioning'

type Props = {
  editionLabel: string
  voiceCount: number
  hasMine: boolean
  onExplore: () => void
  onFindMine: () => void
  onCertificate: () => void
}

/**
 * Section 31 — After the event.
 * The product is dead. The artifact lives.
 */
export function AfterlifeHero({
  editionLabel,
  voiceCount,
  hasMine,
  onExplore,
  onFindMine,
  onCertificate,
}: Props) {
  return (
    <section className="afterlife-hero" aria-label="The Wall archive">
      <div className="afterlife-inner">
        <p className="afterlife-brand">THE WALL</p>
        <p className="afterlife-date">{editionLabel}</p>
        <p className="afterlife-voices">
          {voiceCount.toLocaleString()} voices.
        </p>
        <p className="afterlife-dead">The product itself is dead. The artifact lives.</p>

        <div className="afterlife-actions">
          <button type="button" className="btn primary lg" onClick={onExplore}>
            Explore the archive
          </button>
          <button
            type="button"
            className="btn ghost lg on-dark"
            onClick={onFindMine}
            disabled={!hasMine}
          >
            Find your message
          </button>
          <button
            type="button"
            className="btn ghost lg on-dark"
            onClick={onCertificate}
            disabled={!hasMine}
          >
            Download certificate
          </button>
        </div>

        <p className="afterlife-line">{MARKETING_LINE}</p>
        <p className="afterlife-positioning">{PRODUCT_POSITIONING}</p>
      </div>
    </section>
  )
}
