import { useEffect, useState } from 'react'
import {
  getReactionChallenge,
  noteHumanSignal,
  solveReactionChallenge,
} from '../lib/reactionGuard'

type Props = {
  message: string | null
  challengeRequired: boolean
  onDismiss: () => void
  onChallengeSolved: () => void
}

export function ReactionToast({
  message,
  challengeRequired,
  onDismiss,
  onChallengeSolved,
}: Props) {
  const [answer, setAnswer] = useState('')
  const [challenge, setChallenge] = useState<{ a: number; b: number } | null>(null)
  const [wrong, setWrong] = useState(false)

  useEffect(() => {
    if (challengeRequired) {
      setChallenge(getReactionChallenge())
      setAnswer('')
      setWrong(false)
    } else {
      setChallenge(null)
    }
  }, [challengeRequired, message])

  useEffect(() => {
    if (!message && !challengeRequired) return
    if (challengeRequired) return
    const id = window.setTimeout(onDismiss, 3200)
    return () => window.clearTimeout(id)
  }, [message, challengeRequired, onDismiss])

  if (!message && !challengeRequired) return null

  return (
    <div className="react-toast" role="status" aria-live="polite">
      <p>{message}</p>
      {challengeRequired && challenge && (
        <form
          className="react-challenge"
          onSubmit={(e) => {
            e.preventDefault()
            const ok = solveReactionChallenge(Number(answer))
            if (ok) {
              setWrong(false)
              onChallengeSolved()
            } else {
              setWrong(true)
            }
          }}
        >
          <label>
            What is {challenge.a} + {challenge.b}?
            <input
              type="number"
              inputMode="numeric"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              autoFocus
            />
          </label>
          {wrong && <span className="react-challenge-err">Try again</span>}
          <button type="submit" className="btn primary">
            Unlock 🔥
          </button>
        </form>
      )}
      {!challengeRequired && (
        <button type="button" className="react-toast-x" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  )
}

/** Install once — feeds bot-protection human signals. */
export function useHumanSignalTracker(): void {
  useEffect(() => {
    const mark = (e: Event) => noteHumanSignal(e)
    const opts = { passive: true } as const
    window.addEventListener('pointerdown', mark, opts)
    window.addEventListener('keydown', mark, opts)
    window.addEventListener('touchstart', mark, opts)
    window.addEventListener('mousemove', mark, opts)
    return () => {
      window.removeEventListener('pointerdown', mark)
      window.removeEventListener('keydown', mark)
      window.removeEventListener('touchstart', mark)
      window.removeEventListener('mousemove', mark)
    }
  }, [])
}
