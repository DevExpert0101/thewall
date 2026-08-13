import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ViewerState, WallMessage, WallState } from '../types'
import {
  getOrCreateViewer,
  loadWall,
  lockFinalRanking,
  resetWall,
  saveViewer,
  saveWall,
  setWallEndingIn,
} from '../lib/storage'
import { appendPrivateTxRecord, isTxHashUsed } from '../lib/privateLedger'
import { clearReactionGuard, evaluateReaction, type ReactGuardResult } from '../lib/reactionGuard'
import {
  clearReactionPulses,
  recordReactionPulse,
  seedPulseBurst,
} from '../lib/reactionPulse'
import { isRemovedMessage, moderateMessage } from '../lib/moderation'
import { assertNotDuplicate } from '../lib/duplicates'
import {
  evaluatePublishVelocity,
  evaluateReactVelocity,
  recordVelocity,
} from '../lib/deviceVelocity'
import {
  evaluatePaymentFraud,
  recordSuccessfulWalletPublish,
} from '../lib/paymentFraud'
import {
  hasReceiptForDevice,
  issueReactionReceipt,
  sortByAuthoritativeTrending,
  trustedReactionCount,
} from '../lib/rankingAuthority'
import { verifyTurnstileToken } from '../lib/turnstile'

/** Lifetime totals — useful for display, not for TRENDING rank */
function sortByReactions(messages: WallMessage[]): WallMessage[] {
  return [...messages].sort((a, b) => {
    if (b.reactions !== a.reactions) return b.reactions - a.reactions
    return b.number - a.number
  })
}

/** Newest first — chronological LIVE stream */
function sortChronological(messages: WallMessage[]): WallMessage[] {
  return [...messages].sort((a, b) => {
    if (b.number !== a.number) return b.number - a.number
    return b.createdAt - a.createdAt
  })
}

export function useWall() {
  const [wall, setWall] = useState<WallState>(() => loadWall())
  const [viewer, setViewer] = useState<ViewerState>(() => getOrCreateViewer())
  const [now, setNow] = useState(() => Date.now())
  const [trendClock, setTrendClock] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (wall.frozen) return
    const id = window.setInterval(() => setTrendClock(Date.now()), 4000)
    return () => window.clearInterval(id)
  }, [wall.frozen])

  // Count this browser once as a viewer; then gently tick for live feel
  useEffect(() => {
    if (!viewer.countedAsViewer) {
      const nextViewer = { ...viewer, countedAsViewer: true }
      saveViewer(nextViewer)
      setViewer(nextViewer)
      setWall((w) => {
        if (w.frozen) return w
        const next = { ...w, viewerCount: (w.viewerCount ?? 0) + 1 }
        saveWall(next)
        return next
      })
    }
  }, [viewer])

  useEffect(() => {
    if (wall.frozen) return
    const id = window.setInterval(() => {
      setWall((prev) => {
        if (prev.frozen) return prev
        const bump = Math.random() < 0.55 ? 1 : 0
        if (!bump) return prev
        const next = { ...prev, viewerCount: prev.viewerCount + bump }
        saveWall(next)
        return next
      })
    }, 4200)
    return () => window.clearInterval(id)
  }, [wall.frozen])

  useEffect(() => {
    if (!wall.frozen && now >= wall.endsAt) {
      setWall((prev) => {
        if (prev.frozen) return prev
        const next = lockFinalRanking({ ...prev, frozen: true })
        saveWall(next)
        return next
      })
    }
  }, [now, wall.endsAt, wall.frozen])

  // Simulated live reactions — dead walls never gain new 🔥
  useEffect(() => {
    if (wall.frozen) return
    const id = window.setInterval(() => {
      setWall((prev) => {
        if (prev.frozen || prev.messages.length === 0) return prev
        const chrono = sortChronological(prev.messages).filter((m) => m.id.startsWith('seed_'))
        const pool =
          Math.random() < 0.45
            ? chrono.slice(0, Math.min(8, chrono.length))
            : sortByReactions(prev.messages).filter((m) => m.id.startsWith('seed_')).slice(0, 12)
        if (pool.length === 0) return prev
        const target = pool[Math.floor(Math.random() * pool.length)]
        recordReactionPulse(target.id)
        if (Math.random() < 0.12) seedPulseBurst(target.id, 3 + Math.floor(Math.random() * 5))
        const messages = prev.messages.map((m) =>
          m.id === target.id ? { ...m, reactions: m.reactions + 1 } : m,
        )
        const next = { ...prev, messages }
        saveWall(next)
        return next
      })
    }, 2800)
    return () => window.clearInterval(id)
  }, [wall.frozen])

  const remainingMs = Math.max(0, wall.endsAt - now)
  const live = useMemo(() => sortChronological(wall.messages), [wall.messages])
  const trending = useMemo(() => {
    if (wall.frozen && wall.finalRankingIds?.length) {
      const order = new Map(wall.finalRankingIds.map((id, i) => [id, i]))
      return [...wall.messages].sort(
        (a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9),
      )
    }
    // Competitive rank is receipt-backed (server-side authority prototype)
    return sortByAuthoritativeTrending(
      wall.messages,
      wall.frozen ? wall.endsAt : trendClock,
    )
  }, [wall.messages, wall.frozen, wall.finalRankingIds, wall.endsAt, trendClock])
  /** Competitive rank — locked forever after The Wall dies */
  const ranked = trending
  const messageCount = wall.nextNumber - 1

  const postMessage = useCallback(
    (
      text: string,
      opts: {
        txHash: string
        payerWallet: string
        valueWei: string
        turnstileToken: string
      },
    ): WallMessage | null => {
      const trimmed = text.trim().slice(0, 140)
      const txHash = opts.txHash.trim().toLowerCase()
      if (!trimmed || wall.frozen || !txHash) return null

      const velocity = evaluatePublishVelocity()
      if (!velocity.ok) throw new Error(velocity.reason)

      const verdict = moderateMessage(trimmed)
      if (!verdict.ok) {
        throw new Error(verdict.reason ?? 'Message rejected by moderation.')
      }

      const current = loadWall()
      if (current.frozen) return null
      if (current.submissionsPaused) {
        throw new Error('Submissions are paused by operators. Try again later.')
      }

      const dup = assertNotDuplicate(trimmed, current.messages)
      if (!dup.ok) throw new Error(dup.reason)

      const turnstileOk = verifyTurnstileToken(opts.turnstileToken)
      const fraud = evaluatePaymentFraud({
        txHash,
        payerWallet: opts.payerWallet,
        valueWei: opts.valueWei,
        turnstileToken: opts.turnstileToken,
        turnstileOk,
      })
      if (!fraud.ok) throw new Error(fraud.reason)

      if (isTxHashUsed(txHash)) {
        throw new Error('This payment transaction was already used.')
      }

      const created: WallMessage = {
        id: `msg_${Date.now().toString(36)}`,
        text: trimmed,
        createdAt: Date.now(),
        reactions: 0,
        number: current.nextNumber,
      }

      // Private ledger first — public wall never stores payment identity
      appendPrivateTxRecord({
        messageId: created.id,
        messageNumber: created.number,
        txHash,
        payerWallet: opts.payerWallet,
        valueWei: opts.valueWei,
        internalSessionId: viewer.viewerKey,
      })

      recordSuccessfulWalletPublish(opts.payerWallet)
      recordVelocity('publish', created.id)

      const nextWall: WallState = {
        ...current,
        messages: [created, ...current.messages],
        nextNumber: current.nextNumber + 1,
      }
      saveWall(nextWall)
      setWall(nextWall)

      const nextViewer: ViewerState = {
        ...viewer,
        myMessageIds: [...viewer.myMessageIds, created.id],
      }
      saveViewer(nextViewer)
      setViewer(nextViewer)

      return created
    },
    [viewer, wall.frozen],
  )

  const react = useCallback(
    (id: string): ReactGuardResult => {
      const target = wall.messages.find((m) => m.id === id)
      if (target && isRemovedMessage(target)) {
        return {
          ok: false,
          reason: 'frozen',
          message: 'Removed messages cannot receive reactions.',
        }
      }

      const velocity = evaluateReactVelocity()
      if (!velocity.ok) {
        return {
          ok: false,
          reason: 'rate_limited',
          message: velocity.reason,
          retryAfterMs: velocity.retryAfterMs,
        }
      }

      const result = evaluateReaction({
        messageId: id,
        reactedIds: viewer.reactedIds,
        frozen: wall.frozen,
      })
      if (!result.ok) return result

      const nextViewer = {
        ...viewer,
        reactedIds: viewer.reactedIds.includes(id)
          ? viewer.reactedIds
          : [...viewer.reactedIds, id],
      }
      // Re-check after evaluate (race / double-click)
      if (viewer.reactedIds.includes(id)) {
        return {
          ok: false,
          reason: 'already_reacted',
          message: 'You already reacted to this message on this device.',
        }
      }

      // Receipt-backed ranking — only signed reactions move TRENDING
      try {
        if (!hasReceiptForDevice(id)) {
          issueReactionReceipt(id)
        }
      } catch {
        return {
          ok: false,
          reason: 'already_reacted',
          message: 'Reaction already recorded for ranking on this device.',
        }
      }

      saveViewer(nextViewer)
      setViewer(nextViewer)

      recordVelocity('react', id)
      recordReactionPulse(id)
      setWall((w) => {
        if (w.frozen) return w
        const messages = w.messages.map((m) => {
          if (m.id !== id) return m
          // User messages: display count follows trusted receipts
          if (!m.id.startsWith('seed_')) {
            return { ...m, reactions: trustedReactionCount(m.id) }
          }
          return { ...m, reactions: m.reactions + 1 }
        })
        const next = { ...w, messages }
        saveWall(next)
        return next
      })

      return { ok: true }
    },
    [viewer, wall.frozen, wall.messages],
  )

  const myMessages = useMemo(
    () => ranked.filter((m) => viewer.myMessageIds.includes(m.id)),
    [ranked, viewer.myMessageIds],
  )

  const restartDemo = useCallback(() => {
    clearReactionGuard()
    clearReactionPulses()
    const next = resetWall()
    setWall(next)
    setNow(Date.now())
    setTrendClock(Date.now())
  }, [])

  const demoEndIn = useCallback((ms: number) => {
    const next = setWallEndingIn(ms)
    setWall(next)
    setNow(Date.now())
    setTrendClock(Date.now())
  }, [])

  const triggerFinale = useCallback(() => {
    const next = setWallEndingIn(3200)
    setWall(next)
    setNow(Date.now())
    setTrendClock(Date.now())
  }, [])

  const applyWall = useCallback((next: WallState) => {
    saveWall(next)
    setWall(next)
  }, [])

  const setSubmissionsPaused = useCallback((paused: boolean) => {
    setWall((prev) => {
      if (prev.frozen) return prev
      const next = { ...prev, submissionsPaused: paused }
      saveWall(next)
      return next
    })
  }, [])

  const endEventNow = useCallback(() => {
    setWall((prev) => {
      if (prev.frozen) return prev
      const next = lockFinalRanking({
        ...prev,
        endsAt: Date.now(),
        frozen: true,
        submissionsPaused: true,
      })
      saveWall(next)
      return next
    })
    setNow(Date.now())
    setTrendClock(Date.now())
  }, [])

  return {
    wall,
    viewer,
    now,
    remainingMs,
    live,
    ranked,
    trending,
    myMessages,
    messageCount,
    postMessage,
    react,
    restartDemo,
    demoEndIn,
    triggerFinale,
    applyWall,
    setSubmissionsPaused,
    endEventNow,
  }
}
