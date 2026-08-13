import type { WallMessage } from '../types'
import { formatFire, formatMessageNumber } from '../lib/format'
import { isRemovedMessage } from '../lib/moderation'

type Props = {
  message: WallMessage
  rank: number
  reacted: boolean
  mine: boolean
  frozen: boolean
  /** Museum: hide reaction controls entirely */
  museum?: boolean
  highlight?: boolean
  variant?: 'live' | 'trending'
  trendingPlace?: number
  onReact: (id: string) => void
  onShare: (message: WallMessage) => void
  onReport: (message: WallMessage) => void
}

export function MessageRow({
  message,
  rank,
  reacted,
  mine,
  frozen,
  museum = false,
  highlight,
  variant = 'live',
  trendingPlace,
  onReact,
  onShare,
  onReport,
}: Props) {
  const serial = formatMessageNumber(message.number)
  const removed = isRemovedMessage(message)
  const showReact = !frozen && !museum && !removed

  const actions = (
    <div className="msg-actions">
      {showReact ? (
        <button
          type="button"
          className={`fire-btn ${reacted ? 'on' : ''}`}
          disabled={reacted}
          onClick={() => onReact(message.id)}
          aria-label={reacted ? 'Already reacted' : 'React with fire'}
        >
          <span aria-hidden="true">🔥</span>
          <span>{formatFire(message.reactions)}</span>
        </button>
      ) : (
        <div className="fire-readonly" title={removed ? 'Removed' : 'Reactions locked forever'}>
          <span aria-hidden="true">🔥</span>
          <span>{formatFire(message.reactions)}</span>
        </div>
      )}
      {!removed && (
        <button
          type="button"
          className="share-btn"
          onClick={() => onShare(message)}
          aria-label={`Share ${serial}`}
        >
          Share
        </button>
      )}
      <button
        type="button"
        className="report-btn"
        onClick={() => onReport(message)}
        aria-label={`Report ${serial}`}
        disabled={removed}
      >
        Report
      </button>
    </div>
  )

  if (variant === 'trending') {
    return (
      <article
        className={`msg msg-trending ${mine ? 'mine' : ''} ${highlight ? 'highlight' : ''} ${removed ? 'removed' : ''}`}
        id={`msg-${message.id}`}
        data-number={message.number}
      >
        <div className="msg-trend-place">#{trendingPlace ?? rank}</div>
        <div className="msg-body">
          <div className="msg-trend-line">
            <span className="msg-serial-num">{serial}</span>
            <span className="msg-trend-fires">🔥 {formatFire(message.reactions)}</span>
          </div>
          <p className="msg-text">{removed ? message.text : `“${message.text}”`}</p>
          <div className="msg-meta">
            <span className="badge-anon">Anonymous</span>
            {removed && <span className="badge-removed">Removed</span>}
            {museum && rank > 0 && (
              <span className="badge-rank">Final rank #{rank}</span>
            )}
            {mine && <span className="badge-mine">Yours</span>}
          </div>
        </div>
        {actions}
      </article>
    )
  }

  return (
    <article
      className={`msg msg-live ${mine ? 'mine' : ''} ${highlight ? 'highlight' : ''} ${removed ? 'removed' : ''}`}
      id={`msg-${message.id}`}
      data-number={message.number}
    >
      <div className="msg-serial" title={`Permanent number ${serial}`}>
        <span className="msg-serial-num">{serial}</span>
      </div>
      <div className="msg-body">
        <p className="msg-text">{removed ? message.text : `“${message.text}”`}</p>
        <div className="msg-meta">
          <span className="badge-anon">Anonymous</span>
          {removed && <span className="badge-removed">Removed</span>}
          {museum && rank > 0 && (
            <span className="badge-rank">Final rank #{rank}</span>
          )}
          {mine && (
            <span className="badge-mine" title="Visible only on this device">
              Yours
            </span>
          )}
        </div>
      </div>
      {actions}
    </article>
  )
}
