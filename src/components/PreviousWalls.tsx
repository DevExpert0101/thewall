import { formatFire } from '../lib/format'
import {
  buildWallMuseum,
  type PreviousWallEdition,
} from '../lib/previousWalls'

type GalleryProps = {
  liveTitle: string
  liveDateLabel: string
  liveVoices: number
  liveReactions: number
  frozen: boolean
  onJoin?: () => void
  onExploreLive?: () => void
}

/**
 * Professional archive rail — sits beside the main stage (right sidebar on desktop).
 */
export function PreviousWalls({
  liveTitle,
  liveDateLabel,
  liveVoices,
  liveReactions,
  frozen,
  onJoin,
  onExploreLive,
}: GalleryProps) {
  const editions = buildWallMuseum({
    liveTitle,
    liveDateLabel,
    liveVoices,
    liveReactions,
    frozen,
  })

  const current = editions.find((e) => e.id === 'current')
  const archive = editions.filter((e) => e.id !== 'current')

  return (
    <aside className="prev-walls" id="previous-walls" aria-label="Previous Walls">
      <div className="prev-walls-head">
        <p className="prev-walls-kicker">Archive rail</p>
        <h2>Previous Walls</h2>
        <p>Sealed editions beside today’s stage. Scarcity stays visible.</p>
      </div>

      {current && (
        <div className="prev-walls-current">
          <WallEditionCard
            edition={current}
            onPrimary={
              current.status === 'live'
                ? onJoin
                : frozen
                  ? onExploreLive
                  : undefined
            }
          />
        </div>
      )}

      <p className="prev-walls-section-label">Sealed & upcoming</p>
      <div className="prev-walls-stack">
        {archive.map((ed) => (
          <WallEditionCard key={ed.id} edition={ed} />
        ))}
      </div>
    </aside>
  )
}

function WallEditionCard({
  edition,
  onPrimary,
}: {
  edition: PreviousWallEdition
  onPrimary?: () => void
}) {
  const statusLabel =
    edition.status === 'live'
      ? 'LIVE NOW'
      : edition.status === 'upcoming'
        ? 'UPCOMING'
        : 'SEALED'

  return (
    <article
      className={`prev-wall-card status-${edition.status}`}
      style={{ ['--wall-accent' as string]: edition.accent }}
    >
      <div className="prev-wall-card-top">
        <p className="prev-wall-status">{statusLabel}</p>
        <p className="prev-wall-date">{edition.dateLabel}</p>
      </div>
      <h3>{edition.title}</h3>
      <p className="prev-wall-hook">{edition.hook}</p>
      <blockquote>“{edition.sample}”</blockquote>
      <div className="prev-wall-stats">
        {edition.status === 'upcoming' ? (
          <span>Not yet etched</span>
        ) : (
          <>
            <span>{edition.voices.toLocaleString()} voices</span>
            <span>🔥 {formatFire(edition.reactions)}</span>
          </>
        )}
      </div>
      {onPrimary && (
        <button type="button" className="btn primary" onClick={onPrimary}>
          {edition.status === 'live' ? 'Join — $1' : 'Open archive'}
        </button>
      )}
      {edition.status === 'sealed' && !onPrimary && (
        <p className="prev-wall-sealed">Closed forever</p>
      )}
    </article>
  )
}

export { AttractAd } from './AttractAd'
