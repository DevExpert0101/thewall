import { useEffect, useState } from 'react'
import type { WallMessage } from '../types'
import { formatMessageNumber } from '../lib/format'
import { REPORT_REASONS, type ReportReason, isRemovedMessage } from '../lib/moderation'
import { alreadyReported, submitReport } from '../lib/moderationOps'

type Props = {
  open: boolean
  message: WallMessage | null
  reporterSessionId: string
  onClose: () => void
}

export function ReportMessageModal({
  open,
  message,
  reporterSessionId,
  onClose,
}: Props) {
  const [reason, setReason] = useState<ReportReason>('harassment')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!open) {
      setReason('harassment')
      setNote('')
      setError(null)
      setDone(false)
    }
  }, [open])

  if (!open || !message) return null

  const removed = isRemovedMessage(message)

  function submit() {
    if (!message || removed) return
    setError(null)
    try {
      if (alreadyReported(message.id, reporterSessionId)) {
        throw new Error('You already reported this message from this device.')
      }
      submitReport({
        message,
        reason,
        note,
        reporterSessionId,
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit report.')
    }
  }

  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <button type="button" className="modal-backdrop" aria-label="Close" onClick={onClose} />
      <div className="modal-panel report-panel">
        <p className="modal-kicker">Safety</p>
        <h2 id="report-title">Report message</h2>
        <p className="report-target">{formatMessageNumber(message.number)}</p>

        {removed ? (
          <p className="report-done">This message was already removed by moderation.</p>
        ) : done ? (
          <p className="report-done">
            Report received. Ops will review — emergency removals can still pull content even after
            freeze.
          </p>
        ) : (
          <>
            <fieldset className="report-reasons">
              <legend>Reason</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r.id} className="report-reason">
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </fieldset>

            <label className="report-note">
              <span>Optional detail</span>
              <textarea
                value={note}
                maxLength={280}
                rows={3}
                placeholder="Anything reviewers should know"
                onChange={(e) => setNote(e.target.value)}
              />
            </label>

            {error && <p className="pay-error">{error}</p>}

            <button type="button" className="btn primary wide" onClick={submit}>
              Submit report
            </button>
          </>
        )}

        <button type="button" className="btn ghost wide" onClick={onClose}>
          {done ? 'Close' : 'Cancel'}
        </button>
      </div>
    </div>
  )
}
