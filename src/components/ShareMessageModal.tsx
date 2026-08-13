import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import type { WallMessage } from '../types'
import { formatCountdown, formatFire, formatMessageNumber } from '../lib/format'
import {
  editionStamp,
  messageShareUrl,
  socialIntent,
  withClockCaption,
} from '../lib/shareLinks'
import { loopAwareCaption } from '../lib/viralLoops'
import { Countdown } from './Countdown'

type Props = {
  open: boolean
  message: WallMessage | null
  wallDate: Date
  rank?: number
  frozen?: boolean
  remainingMs: number
  onClose: () => void
}

export function ShareMessageModal({
  open,
  message,
  wallDate,
  rank,
  frozen = false,
  remainingMs,
  onClose,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  if (!open || !message) return null

  const serial = formatMessageNumber(message.number)
  const link = messageShareUrl(message)
  const stamp = editionStamp(wallDate)
  const caption = withClockCaption(
    loopAwareCaption(message, { rank, frozen }),
    remainingMs,
    frozen,
  )
  const clockLabel = frozen
    ? 'FROZEN 00:00:00'
    : `CLOSES IN ${formatCountdown(remainingMs).label}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link:', link)
    }
  }

  async function nativeShare() {
    if (!navigator.share) {
      await copyLink()
      return
    }
    try {
      await navigator.share({
        title: `THE WALL ${serial}`,
        text: caption,
        url: link,
      })
    } catch {
      /* user cancelled */
    }
  }

  async function downloadImage() {
    if (!cardRef.current) return
    setBusy(true)
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#1c1f24',
        scale: 2,
        useCORS: true,
      })
      const a = document.createElement('a')
      a.download = `the-wall-${serial.replace('#', '')}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    } finally {
      setBusy(false)
    }
  }

  function openNetwork(network: 'x' | 'facebook' | 'reddit' | 'whatsapp') {
    window.open(
      socialIntent(network, message!, caption),
      '_blank',
      'noopener,noreferrer',
    )
  }

  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <button type="button" className="modal-backdrop" aria-label="Close" onClick={onClose} />
      <div className="modal-panel share-panel">
        <h2 id="share-title" className="sr-only">
          Share message
        </h2>

        <div className="share-clock-bar">
          <Countdown
            remainingMs={remainingMs}
            frozen={frozen}
            compact
            showMantra
            tone="inset"
          />
        </div>

        <div className="share-card" ref={cardRef}>
          <p className="share-card-brand">THE WALL</p>
          <p className="share-card-date">{stamp}</p>
          <p className="share-card-clock">{clockLabel}</p>
          <blockquote className="share-card-quote">“{message.text}”</blockquote>
          <p className="share-card-serial">{serial}</p>
          <p className="share-card-fires">🔥 {formatFire(message.reactions)}</p>
          <p className="share-card-foot">
            {frozen ? 'YOU ONLY HAD TODAY.' : 'YOU ONLY HAVE TODAY.'}
          </p>
        </div>

        <div className="share-actions">
          <button type="button" className="btn primary wide" onClick={nativeShare}>
            Share
          </button>
          <button type="button" className="btn ghost wide" onClick={copyLink}>
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <div className="share-networks">
            <button type="button" className="chip" onClick={() => openNetwork('x')}>
              X
            </button>
            <button type="button" className="chip" onClick={() => openNetwork('facebook')}>
              Facebook
            </button>
            <button type="button" className="chip" onClick={() => openNetwork('reddit')}>
              Reddit
            </button>
            <button type="button" className="chip" onClick={() => openNetwork('whatsapp')}>
              WhatsApp
            </button>
          </div>
          <button
            type="button"
            className="btn ghost wide"
            disabled={busy}
            onClick={downloadImage}
          >
            {busy ? 'Rendering…' : 'Download image'}
          </button>
        </div>
        <p className="modal-fine share-url">{link}</p>
      </div>
    </div>
  )
}
