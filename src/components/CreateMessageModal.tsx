import { useEffect, useState } from 'react'
import type { WallMessage } from '../types'
import {
  cryptoConfig,
  hasWallet,
  payWithCrypto,
  simulatePayWithCrypto,
  type PayProgress,
  type PaymentPhase,
} from '../lib/cryptoPayment'
import { formatMessageNumber, messageHistoryClaim } from '../lib/format'
import {
  COMPETITION_TEMPLATES,
  FRIEND_TEMPLATES,
  STREAMER_TEMPLATES,
} from '../lib/viralLoops'
import {
  MODERATION_PIPELINE_LABELS,
  moderateMessageAsync,
  type ModerationStageId,
  type ModerationStageResult,
} from '../lib/moderation'
import { assertNotDuplicate } from '../lib/duplicates'
import { beginPaymentAttempt } from '../lib/paymentFraud'
import { getValidTurnstileToken } from '../lib/turnstile'
import { TurnstileGate } from './TurnstileGate'
import { Countdown } from './Countdown'

type Step = 'compose' | 'moderation' | 'payment' | 'accepted'

const PIPELINE_ORDER: ModerationStageId[] = [
  'length',
  'spam',
  'pii',
  'url',
  'adult',
  'threat',
  'ai',
]

type Props = {
  open: boolean
  onClose: () => void
  edition: string
  nextNumber: number
  initialText?: string
  existingMessages: WallMessage[]
  remainingMs: number
  frozen: boolean
  onCreate: (text: string, payment: {
    txHash: string
    payerWallet: string
    valueWei: string
    turnstileToken: string
  }) => WallMessage | null
  onViewMessage: (messageId: string) => void
}

const PHASE_COPY: Record<PaymentPhase, string> = {
  idle: 'Ready',
  connecting: 'Connecting wallet…',
  awaiting_signature: 'Confirm the payment in your wallet…',
  submitted: 'Transaction submitted. Waiting for inclusion…',
  confirming: 'Confirming on-chain…',
  verified: 'Payment verified. Publishing your message…',
  failed: 'Payment failed',
}

export function CreateMessageModal({
  open,
  onClose,
  edition,
  nextNumber,
  initialText = '',
  existingMessages,
  remainingMs,
  frozen,
  onCreate,
  onViewMessage,
}: Props) {
  const [step, setStep] = useState<Step>('compose')
  const [text, setText] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [progress, setProgress] = useState<PayProgress>({ phase: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState<WallMessage | null>(null)
  const [modStages, setModStages] = useState<ModerationStageResult[]>([])
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const demoEnabled = import.meta.env.VITE_ALLOW_DEMO_CRYPTO === 'true'

  useEffect(() => {
    if (!open) {
      setStep('compose')
      setText('')
      setAgreed(false)
      setProgress({ phase: 'idle' })
      setError(null)
      setAccepted(null)
      setModStages([])
      setCaptchaToken(null)
      return
    }
    setText(initialText.slice(0, 140))
    setCaptchaToken(getValidTurnstileToken())
  }, [open, initialText])

  if (!open) return null

  const clock = (
    <div className="modal-clock">
      <Countdown
        remainingMs={remainingMs}
        frozen={frozen}
        compact
        showMantra
        tone="inset"
      />
    </div>
  )

  const used = text.length
  const busy =
    step === 'moderation' || (step === 'payment' && progress.phase !== 'failed')
  const canPay =
    Boolean(text.trim()) && agreed && Boolean(captchaToken) && !busy

  async function beginPublish(mode: 'wallet' | 'demo') {
    if (!canPay) return
    setError(null)

    const token = captchaToken || getValidTurnstileToken()
    if (!token) {
      setError('Complete the CAPTCHA / Turnstile check first.')
      return
    }

    const dup = assertNotDuplicate(text, existingMessages)
    if (!dup.ok) {
      setError(dup.reason)
      return
    }

    const payGate = beginPaymentAttempt()
    if (!payGate.ok) {
      setError(payGate.reason)
      return
    }

    setModStages([])
    setStep('moderation')

    const verdict = await moderateMessageAsync(text, (stage, index) => {
      setModStages((prev) => {
        const next = prev.slice()
        next[index] = stage
        return next
      })
    })

    if (!verdict.ok) {
      setError(verdict.reason ?? 'Message rejected by moderation.')
      setStep('compose')
      return
    }

    await runPayment(mode, token)
  }

  async function runPayment(mode: 'wallet' | 'demo', turnstileToken: string) {
    setError(null)
    setStep('payment')
    setProgress({ phase: 'connecting' })

    try {
      const verified =
        mode === 'demo'
          ? await simulatePayWithCrypto(setProgress)
          : await payWithCrypto(setProgress)

      // Publish ONLY after captcha + moderation + payment fraud checks
      const created = onCreate(text, {
        txHash: verified.txHash,
        payerWallet: verified.from,
        valueWei: verified.valueWei.toString(),
        turnstileToken,
      })
      if (!created) {
        throw new Error('Payment verified, but publishing failed. Contact support with your tx hash.')
      }
      setAccepted(created)
      setStep('accepted')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment failed.'
      setError(msg)
      setProgress((p) => ({ ...p, phase: 'failed', error: msg }))
    }
  }

  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="create-title">
      <button
        type="button"
        className="modal-backdrop"
        aria-label="Close"
        onClick={onClose}
        disabled={
          step === 'moderation' ||
          (step === 'payment' && progress.phase !== 'failed')
        }
      />

      {step === 'compose' && (
        <div className="modal-panel create-panel">
          {clock}
          <p className="modal-kicker">Belong before it freezes.</p>
          <h2 id="create-title">Be part of this</h2>
          <p className="create-next-number">
            Your forever number will be{' '}
            <strong>{formatMessageNumber(nextNumber)}</strong>
          </p>
          <p className="create-belong-line">
            Your line joins everyone else’s — forever. Miss the clock and it’s gone.
          </p>
          <p className="create-limit">140 characters maximum.</p>

          <div className="compose-templates" aria-label="Viral loop starters">
            <p className="compose-templates-label">Spark a loop</p>
            <div className="compose-template-rows">
              <TemplateGroup
                label="Friends"
                templates={FRIEND_TEMPLATES}
                onPick={setText}
              />
              <TemplateGroup
                label="Competition"
                templates={COMPETITION_TEMPLATES}
                onPick={setText}
              />
              <TemplateGroup
                label="Streamers"
                templates={STREAMER_TEMPLATES}
                onPick={setText}
              />
            </div>
          </div>

          <textarea
            value={text}
            maxLength={140}
            rows={5}
            autoFocus
            placeholder="What do you want the world to know?"
            onChange={(e) => setText(e.target.value)}
          />

          <div className="create-count" aria-live="polite">
            <span className={used > 130 ? 'warn' : ''}>
              {used} / 140
            </span>
          </div>

          <label className="create-rules">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>
              I agree to{' '}
              <button
                type="button"
                className="rules-link"
                onClick={(e) => {
                  e.preventDefault()
                  window.alert(
                    'The Wall rules (prototype):\n\n• One anonymous message, max 140 characters.\n• Automatic moderation before payment: length, spam, PII, URLs, adult, threats, AI check.\n• No illegal content, threats, doxxing, links, or contact info.\n• Messages publish only after moderation + confirmed crypto payment.\n• Public freeze is permanent; operators retain emergency removal for policy violations.',
                  )
                }}
              >
                The Wall rules
              </button>
            </span>
          </label>

          <div className="pay-crypto-meta">
            <span>
              Pay {cryptoConfig.paymentLabel} on {cryptoConfig.chain.name}
            </span>
            <span className="pay-crypto-treasury">
              To {shortAddr(cryptoConfig.treasuryAddress)}
            </span>
          </div>

          <TurnstileGate
            onVerified={(session) => setCaptchaToken(session.token)}
            onExpired={() => setCaptchaToken(null)}
          />

          {error && step === 'compose' && <p className="pay-error">{error}</p>}

          <button
            type="button"
            className="btn primary wide"
            disabled={!canPay}
            onClick={() => beginPublish('wallet')}
          >
            {hasWallet() ? 'Verify & pay $1' : 'Verify, connect & pay $1'}
          </button>

          {demoEnabled && (
            <button
              type="button"
              className="btn ghost wide"
              disabled={!canPay}
              onClick={() => beginPublish('demo')}
            >
              Simulate moderation + payment (dev)
            </button>
          )}

          <p className="modal-fine">
            Turnstile → moderation → payment fraud checks → publish. Device velocity and
            duplicate detection apply. You’re buying {formatMessageNumber(nextNumber)} —
            Anonymous only.
          </p>
        </div>
      )}

      {step === 'moderation' && (
        <div className="modal-panel create-panel">
          {clock}
          <p className="modal-kicker">Mandatory moderation</p>
          <h2 id="create-title">Checking your message</h2>
          <p className="mod-pipeline-intro">
            Message → length → spam → PII → URL → adult → threat → AI → publish
          </p>
          <ol className="mod-pipeline">
            {PIPELINE_ORDER.map((id, i) => {
              const result = modStages[i]
              const state = !result ? 'pending' : result.ok ? 'ok' : 'fail'
              return (
                <li key={id} className={`mod-pipeline-step ${state}`}>
                  <span className="mod-pipeline-dot" aria-hidden="true" />
                  <div>
                    <strong>{MODERATION_PIPELINE_LABELS[id]}</strong>
                    <span>{result?.detail ?? 'Waiting…'}</span>
                  </div>
                </li>
              )
            })}
          </ol>
          <p className="modal-fine">Payment starts only if every stage clears.</p>
        </div>
      )}

      {step === 'payment' && (
        <div className="modal-panel create-panel">
          {clock}
          <p className="modal-kicker">Crypto payment · clock still running</p>
          <h2 id="create-title">
            {progress.phase === 'failed' ? 'Payment not confirmed' : 'Checking transaction'}
          </h2>

          <ol className="pay-steps">
            <PayStep
              done={phaseRank(progress.phase) > 1}
              active={progress.phase === 'connecting'}
              label="Connect wallet"
            />
            <PayStep
              done={phaseRank(progress.phase) > 2}
              active={progress.phase === 'awaiting_signature'}
              label="Sign payment"
            />
            <PayStep
              done={phaseRank(progress.phase) > 3}
              active={progress.phase === 'submitted'}
              label="Broadcast transaction"
            />
            <PayStep
              done={phaseRank(progress.phase) > 4}
              active={progress.phase === 'confirming' || progress.phase === 'verified'}
              label={
                progress.confirmations
                  ? `Confirmations ${progress.confirmations}/${cryptoConfig.requiredConfirmations}`
                  : 'Wait for confirmations'
              }
            />
            <PayStep
              done={progress.phase === 'verified'}
              active={false}
              label="Publish message"
            />
          </ol>

          <p className="pay-status" aria-live="polite">
            {PHASE_COPY[progress.phase]}
          </p>

          {progress.txHash && (
            <a
              className="pay-tx-link"
              href={cryptoConfig.explorerTx(progress.txHash)}
              target="_blank"
              rel="noreferrer"
            >
              View tx {shortHash(progress.txHash)}
            </a>
          )}

          {error && <p className="pay-error">{error}</p>}

          {progress.phase === 'failed' && (
            <div className="pay-fail-actions">
              <button type="button" className="btn primary wide" onClick={() => setStep('compose')}>
                Try again
              </button>
              <button type="button" className="btn ghost wide" onClick={onClose}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'accepted' && accepted && (
        <div className="modal-panel create-panel accepted-panel">
          {clock}
          <p className="modal-kicker">Checkout confirmed · You only have today</p>
          <h2 id="create-title">Message accepted</h2>
          <p className="accepted-serial">{formatMessageNumber(accepted.number)}</p>
          <p className="accepted-copy">
            {messageHistoryClaim(accepted.number)}
            <br />
            <strong>The Wall — {edition}.</strong>
          </p>

          <div className="accepted-card">
            <p className="accepted-number">{formatMessageNumber(accepted.number)}</p>
            <p className="accepted-anon">Anonymous</p>
            <p className="accepted-quote">“{accepted.text}”</p>
            <p className="accepted-fires">🔥 {accepted.reactions}</p>
            <p className="accepted-privacy">
              You’re on The Wall — but the clock is still burning. Climb before freeze.
            </p>
          </div>

          <button
            type="button"
            className="btn primary wide"
            onClick={() => {
              onViewMessage(accepted.id)
              onClose()
            }}
          >
            View my message
          </button>
        </div>
      )}
    </div>
  )
}

function PayStep({
  label,
  done,
  active,
}: {
  label: string
  done: boolean
  active: boolean
}) {
  return (
    <li className={`pay-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
      <span className="pay-step-dot" aria-hidden="true" />
      <span>{label}</span>
    </li>
  )
}

function phaseRank(phase: PaymentPhase): number {
  switch (phase) {
    case 'idle':
      return 0
    case 'connecting':
      return 1
    case 'awaiting_signature':
      return 2
    case 'submitted':
      return 3
    case 'confirming':
      return 4
    case 'verified':
      return 5
    case 'failed':
      return -1
    default:
      return 0
  }
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function shortHash(hash: string) {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`
}

function TemplateGroup({
  label,
  templates,
  onPick,
}: {
  label: string
  templates: readonly string[]
  onPick: (text: string) => void
}) {
  return (
    <div className="compose-template-group">
      <span>{label}</span>
      <div>
        {templates.map((t) => (
          <button
            key={t}
            type="button"
            className="chip compose-template-chip"
            onClick={() => onPick(t.slice(0, 140))}
          >
            {t.length > 42 ? `${t.slice(0, 40)}…` : t}
          </button>
        ))}
      </div>
    </div>
  )
}
