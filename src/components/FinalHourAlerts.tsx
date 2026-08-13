import { formatCountdown } from '../lib/format'
import { finalHourHeadline, finalHourStage } from '../lib/positioning'

type Props = {
  remainingMs: number
  frozen: boolean
  messageCount: number
}

/**
 * Aggressive final-hour overlays.
 * 1 HOUR LEFT → 10 MINUTES LEFT → N MESSAGES → THE WALL CLOSES IN 60 SECONDS
 */
export function FinalHourAlerts({ remainingMs, frozen, messageCount }: Props) {
  const stage = finalHourStage(remainingMs, frozen)
  if (stage === 'calm' || frozen) return null

  const headline = finalHourHeadline(stage, messageCount)
  if (!headline) return null

  if (stage === 'sixty') {
    // Finale owns the last 60 seconds
    return null
  }

  return (
    <div
      className={`final-hour final-hour-${stage}`}
      role="status"
      aria-live="polite"
      key={stage}
    >
      <p className="final-hour-line">{headline}</p>
      {stage !== 'voices' && (
        <p className="final-hour-sub">{formatCountdown(remainingMs).label}</p>
      )}
      {stage === 'voices' && (
        <p className="final-hour-sub">Still climbing. Clock still burning.</p>
      )}
    </div>
  )
}

export function currentFinalHourStage(remainingMs: number, frozen: boolean) {
  return finalHourStage(remainingMs, frozen)
}
