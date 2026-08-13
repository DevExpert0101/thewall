export function formatCountdown(ms: number): {
  h: string
  m: string
  s: string
  label: string
} {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return {
    h: pad(h),
    m: pad(m),
    s: pad(s),
    label: `${pad(h)}:${pad(m)}:${pad(s)}`,
  }
}

export function formatFire(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

/**
 * Permanent wall serial — zero-padded, always with #.
 * #000001 … #428913
 */
export function formatMessageNumber(n: number): string {
  const safe = Math.max(0, Math.floor(n))
  const digits = Math.max(6, String(safe).length)
  return `#${String(safe).padStart(digits, '0')}`
}

/** Spoken claim for certificates / share sheets */
export function messageHistoryClaim(n: number): string {
  return `I am ${formatMessageNumber(n)} in The Wall's history.`
}

export function ordinal(n: number): string {
  const j = n % 10
  const k = n % 100
  if (j === 1 && k !== 11) return `${n}st`
  if (j === 2 && k !== 12) return `${n}nd`
  if (j === 3 && k !== 13) return `${n}rd`
  return `${n}th`
}
