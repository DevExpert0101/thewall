import { EDITION_STRATEGY, MARKETING_LINE } from '../lib/positioning'

/**
 * Section 32 — Scarcity is the brand.
 * Never pitch a daily app. Yearly / rare editions only.
 */
export function ScarcityEditions() {
  return (
    <section className="scarcity-editions" aria-label="Edition strategy">
      <div className="scarcity-head">
        <p className="loop-rail-kicker">Scarcity is the brand</p>
        <h2>Not a daily app</h2>
        <p>
          If the first Wall succeeds, don’t flatten it into habit. Keep it rare.
        </p>
      </div>
      <ol className="scarcity-grid">
        {EDITION_STRATEGY.map((ed) => (
          <li key={ed.title}>
            <h3>{ed.title}</h3>
            <p>{ed.note}</p>
          </li>
        ))}
      </ol>
      <p className="scarcity-line">{MARKETING_LINE}</p>
    </section>
  )
}
