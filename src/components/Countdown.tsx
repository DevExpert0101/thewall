import { formatCountdown } from '../lib/format'

type Props = {
  remainingMs: number
  frozen: boolean
  compact?: boolean
  /** Hero-scale urgency clock */
  prominent?: boolean
  /** Always reinforce the product rule */
  showMantra?: boolean
  /** Modal / card surfaces */
  tone?: 'default' | 'on-dark' | 'inset'
  label?: string
}

/**
 * Rule 29 — Never let users forget the clock.
 * The entire product is powered by: “You only have today.”
 */
export function Countdown({
  remainingMs,
  frozen,
  compact,
  prominent,
  showMantra = false,
  tone = 'default',
  label,
}: Props) {
  const t = formatCountdown(remainingMs)
  const classes = [
    'countdown',
    frozen ? 'frozen' : '',
    compact ? 'compact' : '',
    prominent ? 'prominent' : '',
    tone !== 'default' ? `tone-${tone}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const liveLabel =
    label ?? (prominent ? 'Gone forever in' : 'You only have today · closes in')

  if (frozen) {
    return (
      <div className={classes} aria-live="polite">
        <span className="countdown-label">{label ?? 'Frozen forever'}</span>
        <span className="countdown-digits">00:00:00</span>
        {showMantra && (
          <span className="countdown-mantra">You only had today.</span>
        )}
      </div>
    )
  }

  return (
    <div className={classes} aria-live="polite">
      <span className="countdown-label">{liveLabel}</span>
      <span className="countdown-digits">
        <span>{t.h}</span>
        <i>:</i>
        <span>{t.m}</span>
        <i>:</i>
        <span>{t.s}</span>
      </span>
      {showMantra && (
        <span className="countdown-mantra">You only have today.</span>
      )}
    </div>
  )
}
