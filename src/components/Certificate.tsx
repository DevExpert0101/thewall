import { useEffect, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import QRCode from 'qrcode'
import type { WallMessage } from '../types'
import { formatCountdown, formatFire, formatMessageNumber, messageHistoryClaim } from '../lib/format'
import { editionStamp } from '../lib/shareLinks'
import {
  archiveMessageUrl,
  certificateId,
  messageNumberLabel,
  rankLabel,
  voiceOfWallLine,
} from '../lib/certificate'
import { certificateLoopCaption, nextEventTeaser } from '../lib/viralLoops'
import { Countdown } from './Countdown'

type Props = {
  open: boolean
  onClose: () => void
  message: WallMessage | null
  rank: number
  frozen: boolean
  wallDate: Date
  totalMessages: number
  remainingMs: number
}

export function Certificate({
  open,
  onClose,
  message,
  rank,
  frozen,
  wallDate,
  totalMessages,
  remainingMs,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !message) {
      setQrDataUrl(null)
      return
    }
    let cancelled = false
    QRCode.toDataURL(archiveMessageUrl(message), {
      margin: 1,
      width: 140,
      color: { dark: '#1c1f24', light: '#f2ede4' },
      errorCorrectionLevel: 'M',
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [open, message])

  if (!open || !message) return null

  const stamp = editionStamp(wallDate)
  const serial = formatMessageNumber(message.number)
  const certId = certificateId(message, wallDate)
  const claim = messageHistoryClaim(message.number)
  const shareText = certificateLoopCaption(message, rank, frozen)
  const teaser = nextEventTeaser(stamp)
  const clockLine = frozen
    ? 'YOU ONLY HAD TODAY · FROZEN 00:00:00'
    : `YOU ONLY HAVE TODAY · CLOSES IN ${formatCountdown(remainingMs).label}`

  async function download() {
    if (!ref.current) return
    setBusy(true)
    try {
      const canvas = await html2canvas(ref.current, {
        backgroundColor: '#1C1F24',
        scale: 2,
        useCORS: true,
      })
      const a = document.createElement('a')
      a.download = `the-wall-certificate-${serial.replace('#', '')}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    } finally {
      setBusy(false)
    }
  }

  async function share() {
    if (!ref.current) return
    setBusy(true)
    try {
      const canvas = await html2canvas(ref.current, {
        backgroundColor: '#1C1F24',
        scale: 2,
        useCORS: true,
      })
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      )
      const fileName = `the-wall-certificate-${serial.replace('#', '')}.png`
      if (
        blob &&
        navigator.share &&
        navigator.canShare?.({ files: [new File([blob], 'cert.png', { type: 'image/png' })] })
      ) {
        await navigator.share({
          title: `THE WALL — ${serial}`,
          text: shareText,
          files: [new File([blob], fileName, { type: 'image/png' })],
        })
      } else {
        await download()
      }
    } catch {
      await download()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="cert-title">
      <button type="button" className="modal-backdrop" aria-label="Close" onClick={onClose} />
      <div className="modal-panel cert-panel">
        <h2 id="cert-title" className="sr-only">
          Your certificate
        </h2>

        <div className="cert-clock-bar">
          <Countdown
            remainingMs={remainingMs}
            frozen={frozen}
            compact
            showMantra
            tone="inset"
          />
        </div>

        <div className="certificate" ref={ref}>
          <div className="cert-frame cert-frame-v2">
            <p className="cert-brand">THE WALL</p>
            <p className="cert-edition">{stamp}</p>
            <p className="cert-clock-line">{clockLine}</p>

            <p className="cert-serial">{serial}</p>
            <blockquote className="cert-quote">“{message.text}”</blockquote>
            <p className="cert-fires">🔥 {formatFire(message.reactions)}</p>

            <div className="cert-dual">
              <div>
                <strong>{messageNumberLabel(message.number)}</strong>
                <span>Permanent entry order</span>
              </div>
              <div>
                <strong>{rankLabel(rank, frozen)}</strong>
                <span>{frozen ? 'Performance when frozen' : 'Live — clock still running'}</span>
              </div>
            </div>

            <p className="cert-voice">{voiceOfWallLine(message.number, totalMessages)}</p>

            <div className="cert-meta-row">
              <div className="cert-id-block">
                <span>Certificate ID</span>
                <strong>{certId}</strong>
              </div>
              <div className="cert-qr-block">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR code to archived message" width={88} height={88} />
                ) : (
                  <div className="cert-qr-placeholder" aria-hidden="true" />
                )}
                <span>Archive</span>
              </div>
            </div>

            <p className="cert-were-here">YOU WERE HERE.</p>
            {frozen && <p className="cert-next-event">{teaser}</p>}
            <p className="cert-brand-foot">THE WALL</p>
            {!frozen && (
              <p className="cert-provisional">
                You only have today. Final rank locks when the clock hits zero.
              </p>
            )}
          </div>
        </div>

        <div className="cert-actions">
          <button type="button" className="btn primary" disabled={busy} onClick={share}>
            {busy ? 'Rendering…' : 'Share certificate'}
          </button>
          <button type="button" className="btn ghost" disabled={busy} onClick={download}>
            Download PNG
          </button>
        </div>
        <p className="modal-fine">
          {frozen
            ? `Proof you were there. ${claim} The Wall froze — nothing changes.`
            : `Provisional until freeze. ${claim} Final certificate locks when The Wall freezes.`}
        </p>
      </div>
    </div>
  )
}
