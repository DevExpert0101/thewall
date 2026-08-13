import type { WallMessage } from '../types'
import { formatCountdown, formatMessageNumber } from './format'

/** Canonical deep link — opens directly on that message. */
export function messageShareUrl(message: WallMessage, origin = window.location.origin): string {
  const url = new URL(origin + window.location.pathname)
  url.searchParams.set('m', String(message.number))
  return url.toString()
}

export function parseMessageDeepLink(search = window.location.search): number | null {
  const raw = new URLSearchParams(search).get('m')
  if (!raw) return null
  const n = Number(raw.replace(/^#/, ''))
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
}

export function shareCaption(message: WallMessage): string {
  return `"${message.text}" — ${formatMessageNumber(message.number)} on THE WALL. I was here.`
}

export function socialIntent(
  network: 'x' | 'facebook' | 'reddit' | 'whatsapp',
  message: WallMessage,
  caption = shareCaption(message),
) {
  const url = encodeURIComponent(messageShareUrl(message))
  const text = encodeURIComponent(caption)
  switch (network) {
    case 'x':
      return `https://twitter.com/intent/tweet?text=${text}&url=${url}`
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${url}`
    case 'reddit':
      return `https://www.reddit.com/submit?url=${url}&title=${text}`
    case 'whatsapp':
      return `https://wa.me/?text=${text}%20${url}`
  }
}

export function editionStamp(d: Date): string {
  return d
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .replace(',', '')
    .toUpperCase()
}

/** Append clock urgency to share captions — Rule 29. */
export function withClockCaption(
  base: string,
  remainingMs: number,
  frozen: boolean,
): string {
  if (frozen) return `${base} The Wall froze. You only had today.`
  return `${base} Closes in ${formatCountdown(remainingMs).label}. You only have today.`
}
