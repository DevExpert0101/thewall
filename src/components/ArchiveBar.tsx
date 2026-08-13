import type { WallArtifactStats } from '../lib/archive'
import {
  downloadHtmlArchive,
  downloadJsonArchive,
  openPdfCollectible,
} from '../lib/archive'
import type { WallState } from '../types'

type Props = {
  wall: WallState
  stats: WallArtifactStats
  onReplayMonument: () => void
}

export function ArchiveBar({ wall, stats, onReplayMonument }: Props) {
  return (
    <section className="archive-bar" aria-label="Final artifact downloads">
      <div className="archive-bar-copy">
        <strong>{stats.edition}</strong>
        <span>
          Frozen time capsule · Nothing changes ·{' '}
          {stats.messageCount.toLocaleString()} messages ·{' '}
          {stats.reactionCount.toLocaleString()} 🔥 · Certificates prove you were there
        </span>
      </div>
      <div className="archive-bar-actions">
        <button type="button" className="chip accent" onClick={() => downloadHtmlArchive(wall, stats)}>
          HTML archive
        </button>
        <button type="button" className="chip" onClick={() => openPdfCollectible(wall, stats)}>
          PDF collectible
        </button>
        <button type="button" className="chip" onClick={() => downloadJsonArchive(wall, stats)}>
          JSON dataset
        </button>
        <button type="button" className="chip" onClick={onReplayMonument}>
          Replay finale
        </button>
      </div>
    </section>
  )
}
