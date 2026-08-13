import { useEffect, useState } from 'react'
import { formatCountdown, formatFire } from '../lib/format'
import type { WallArtifactStats } from '../lib/archive'
import { MARKETING_LINE } from '../lib/positioning'

export type FinalePhase = 'hidden' | 'countdown' | 'closed' | 'monument' | 'done'

type Props = {
  remainingMs: number
  frozen: boolean
  stats: WallArtifactStats
  hasMine: boolean
  phase: FinalePhase
  onPhase: (p: FinalePhase) => void
  onExplore: () => void
  onFindMine: () => void
  onCertificate: () => void
}

export function Finale({
  remainingMs,
  frozen,
  stats,
  hasMine,
  phase,
  onPhase,
  onExplore,
  onFindMine,
  onCertificate,
}: Props) {
  const [closedHold, setClosedHold] = useState(false)

  // Aggressive last-minute takeover (60s)
  useEffect(() => {
    if (frozen) return
    if (remainingMs > 0 && remainingMs <= 60_000 && phase === 'hidden') {
      onPhase('countdown')
    }
  }, [remainingMs, frozen, phase, onPhase])

  useEffect(() => {
    if (!frozen) return
    if (phase === 'countdown' || phase === 'hidden') {
      onPhase('closed')
      setClosedHold(true)
    }
  }, [frozen, phase, onPhase])

  useEffect(() => {
    if (phase !== 'closed' || !closedHold) return
    const id = window.setTimeout(() => {
      setClosedHold(false)
      onPhase('monument')
    }, 2400)
    return () => window.clearTimeout(id)
  }, [phase, closedHold, onPhase])

  if (phase === 'hidden' || phase === 'done') return null

  const t = formatCountdown(Math.max(0, remainingMs))
  const showSeconds =
    phase === 'countdown' && !frozen
      ? Math.max(1, Math.ceil(remainingMs / 1000))
      : 0

  return (
    <div className={`finale finale-${phase}`} role="dialog" aria-modal="true" aria-label="Wall finale">
      <div className="finale-bg" aria-hidden="true" />

      {phase === 'countdown' && (
        <div className="finale-countdown" aria-live="assertive">
          <p className="finale-kicker">THE WALL CLOSES IN 60 SECONDS</p>
          <p className="finale-digits">
            {t.m}:{t.s}
          </p>
          <p className="finale-beat">{showSeconds}</p>
          <p className="finale-voices-flash">
            {stats.messageCount.toLocaleString()} MESSAGES
          </p>
        </div>
      )}

      {phase === 'closed' && (
        <div className="finale-closed" aria-live="assertive">
          <p className="finale-closed-line">THE WALL FREEZES.</p>
          <p className="finale-closed-sub">
            Nothing changes.
            <br />
            {stats.messageCount.toLocaleString()} voices.
            <br />
            {formatFire(stats.reactionCount)} reactions.
          </p>
          <p className="finale-closed-lock">The product is dead. The artifact lives.</p>
        </div>
      )}

      {phase === 'monument' && (
        <div className="finale-monument">
          <p className="finale-brand">THE WALL</p>
          <p className="finale-stamp">{stats.stamp}</p>
          <p className="finale-voices-hero">
            {stats.messageCount.toLocaleString()} voices.
          </p>
          <p className="finale-capsule">
            Every message is now part of a permanent digital time capsule.
          </p>
          <div className="finale-actions">
            <button
              type="button"
              className="btn primary lg"
              onClick={() => {
                onPhase('done')
                onExplore()
              }}
            >
              Explore the archive
            </button>
            <button
              type="button"
              className="btn ghost lg on-dark"
              onClick={() => {
                onPhase('done')
                onFindMine()
              }}
              disabled={!hasMine}
            >
              Find your message
            </button>
            <button
              type="button"
              className="btn ghost lg on-dark"
              onClick={() => {
                onPhase('done')
                onCertificate()
              }}
              disabled={!hasMine}
            >
              Download certificate
            </button>
          </div>
          <p className="finale-never">{MARKETING_LINE}</p>
        </div>
      )}
    </div>
  )
}
