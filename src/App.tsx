import { useCallback, useEffect, useMemo, useState } from 'react'
import { useWall } from './hooks/useWall'
import { Countdown } from './components/Countdown'
import { WallExplorer, type WallMode } from './components/WallExplorer'
import { CreateMessageModal } from './components/CreateMessageModal'
import { Certificate } from './components/Certificate'
import { ReactionToast, useHumanSignalTracker } from './components/ReactionToast'
import { FireRace } from './components/FireRace'
import { ShareMessageModal } from './components/ShareMessageModal'
import { ReportMessageModal } from './components/ReportMessageModal'
import { AdminDashboard } from './components/AdminDashboard'
import { Finale, type FinalePhase } from './components/Finale'
import { ArchiveBar } from './components/ArchiveBar'
import { FriendsLoopRail } from './components/FriendsLoopRail'
import { StreamerDeck } from './components/StreamerDeck'
import { ViralLoopsMap } from './components/ViralLoopsMap'
import { PsychologyMap } from './components/PsychologyMap'
import { wallTitleFromDate } from './data/seed'
import { formatCountdown, formatFire, formatMessageNumber } from './lib/format'
import { parseMessageDeepLink } from './lib/shareLinks'
import { wallStats } from './lib/archive'
import { AfterlifeHero } from './components/AfterlifeHero'
import { FinalHourAlerts } from './components/FinalHourAlerts'
import { ScarcityEditions } from './components/ScarcityEditions'
import { AttractAd, PreviousWalls } from './components/PreviousWalls'
import { MARKETING_LINE, PRODUCT_POSITIONING } from './lib/positioning'
import { COMPETITION_TEMPLATES } from './lib/viralLoops'
import { PSYCH_COPY } from './lib/psychology'
import type { WallMessage } from './types'
import './App.css'

function finaleStorageKey(startedAt: number) {
  return `the-wall:finale-done:${startedAt}`
}

function App() {
  const {
    wall,
    viewer,
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
  } = useWall()

  const [createOpen, setCreateOpen] = useState(false)
  const [certOpen, setCertOpen] = useState(false)
  const [certMessageId, setCertMessageId] = useState<string | null>(null)
  const [shareMessage, setShareMessage] = useState<WallMessage | null>(null)
  const [reportMessage, setReportMessage] = useState<WallMessage | null>(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const [filterMine, setFilterMine] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [mode, setMode] = useState<WallMode>('live')
  const [reactToast, setReactToast] = useState<string | null>(null)
  const [challengeOpen, setChallengeOpen] = useState(false)
  const [finalePhase, setFinalePhase] = useState<FinalePhase>('hidden')
  const [composeSeed, setComposeSeed] = useState('')

  useHumanSignalTracker()

  const wallDate = useMemo(() => new Date(wall.startedAt), [wall.startedAt])
  const edition = wallTitleFromDate(wallDate)
  const stats = useMemo(() => wallStats(wall, wallDate), [wall, wallDate])

  const setPhase = useCallback(
    (p: FinalePhase) => {
      setFinalePhase(p)
      if (p === 'done') {
        sessionStorage.setItem(finaleStorageKey(wall.startedAt), '1')
      }
    },
    [wall.startedAt],
  )

  // Session init only — don't interrupt a live countdown→closed sequence
  useEffect(() => {
    const seen = sessionStorage.getItem(finaleStorageKey(wall.startedAt))
    if (wall.frozen) {
      setFinalePhase(seen ? 'done' : 'monument')
    } else {
      setFinalePhase('hidden')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wall.startedAt])

  const certMessage =
    ranked.find((m) => m.id === certMessageId) ?? myMessages[0] ?? null
  const certRank = certMessage
    ? ranked.findIndex((m) => m.id === certMessage.id) + 1
    : 0

  const raceFirst = trending[0] ?? null
  const raceSecond = trending[1] ?? null
  const finaleActive =
    finalePhase === 'countdown' ||
    finalePhase === 'closed' ||
    finalePhase === 'monument'

  function focusMessage(id: string, nextMode: WallMode = 'live') {
    setHighlightId(id)
    setFilterMine(false)
    setQuery('')
    setMode(nextMode)
    requestAnimationFrame(() => {
      document.getElementById(`msg-${id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })
    window.setTimeout(() => setHighlightId(null), 4200)
  }

  function handleReact(id: string) {
    const result = react(id)
    if (result.ok) return
    setReactToast(result.message)
    if (result.reason === 'challenge_required') setChallengeOpen(true)
  }

  function startCreate(seed = '') {
    if (wall.frozen || wall.submissionsPaused) return
    setComposeSeed(seed)
    setCreateOpen(true)
  }

  const shareRank = shareMessage
    ? ranked.findIndex((m) => m.id === shareMessage.id) + 1
    : 0

  useEffect(() => {
    const n = parseMessageDeepLink()
    if (!n) return
    const target = wall.messages.find((m) => m.number === n)
    if (!target) return
    const t = window.setTimeout(() => {
      document.getElementById('live-wall')?.scrollIntoView({ behavior: 'smooth' })
      focusMessage(target.id, 'live')
    }, 350)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wall.messages.length])

  return (
    <div
      className={`app ${wall.frozen ? 'is-frozen' : ''} ${finaleActive ? 'finale-lock' : ''}`}
    >
      <div className="atmosphere" aria-hidden="true" />

      <header className="topbar">
        <div className="topbar-brand">THE WALL</div>
        <Countdown remainingMs={remainingMs} frozen={wall.frozen} compact showMantra />
        <div className="topbar-stats">
          <span>Latest {formatMessageNumber(messageCount)}</span>
          <span>👁 {wall.viewerCount.toLocaleString()}</span>
        </div>
      </header>

      {wall.frozen && finalePhase === 'done' && (
        <ArchiveBar
          wall={wall}
          stats={stats}
          onReplayMonument={() => setPhase('monument')}
        />
      )}

      {!wall.frozen && wall.submissionsPaused && (
        <div className="pause-banner" role="status">
          Submissions paused by operators. You can still read and react.
        </div>
      )}

      <FinalHourAlerts
        remainingMs={remainingMs}
        frozen={wall.frozen}
        messageCount={messageCount}
      />

      {wall.frozen && finalePhase === 'done' ? (
        <AfterlifeHero
          editionLabel={edition.toUpperCase()}
          voiceCount={messageCount}
          hasMine={myMessages.length > 0}
          onExplore={() => {
            document.getElementById('live-wall')?.scrollIntoView({ behavior: 'smooth' })
          }}
          onFindMine={() => {
            if (myMessages[0]) focusMessage(myMessages[0].id, 'live')
            else document.getElementById('live-wall')?.scrollIntoView({ behavior: 'smooth' })
          }}
          onCertificate={() => {
            if (myMessages[0]) {
              setCertMessageId(myMessages[0].id)
              setCertOpen(true)
            }
          }}
        />
      ) : (
      <section className="hero">
        <div className="hero-inner">
          <p className="hero-brand-mark">THE WALL</p>
          <h1>THE WALL</h1>
          <p className="hero-hook">
            {PSYCH_COPY.heroLive}
            <br />
            {PSYCH_COPY.heroLiveSub}
          </p>
          <p className="hero-positioning">{PRODUCT_POSITIONING}</p>

          <div className="hero-clock">
            <Countdown
              remainingMs={remainingMs}
              frozen={wall.frozen}
              prominent
              showMantra
            />
          </div>

          <p className="hero-fomo-beat" aria-live="polite">
            If you don’t do it now, it’s gone forever.
          </p>

          <div className="hero-social" aria-label="Live activity">
            <div>
              <span className="hero-social-icon" aria-hidden="true">
                #
              </span>
              <strong>{formatMessageNumber(messageCount).replace('#', '')}</strong>
              <span>people already here</span>
            </div>
            <div>
              <span className="hero-social-icon" aria-hidden="true">
                🔥
              </span>
              <strong>{formatFire(stats.reactionCount)}</strong>
              <span>fighting for #1</span>
            </div>
          </div>

          <div className="hero-cta">
            <a className="btn ghost lg on-dark" href="#live-wall">
              {PSYCH_COPY.readCta}
            </a>
            {!wall.submissionsPaused ? (
              <button type="button" className="btn primary lg" onClick={() => startCreate()}>
                {PSYCH_COPY.belongCta}
              </button>
            ) : (
              <button type="button" className="btn ghost lg on-dark" disabled>
                Submissions paused
              </button>
            )}
          </div>
          <p className="hero-free-note">{MARKETING_LINE}</p>
        </div>
      </section>
      )}

      {!finaleActive && (
        <div className="stage-shell">
          <div className="stage-main">
            <AttractAd
              frozen={wall.frozen}
              remainingLabel={formatCountdown(remainingMs).label}
              voiceCount={messageCount}
              onJoin={() => startCreate()}
              onRead={() => {
                if (wall.frozen) {
                  document.getElementById('previous-walls')?.scrollIntoView({ behavior: 'smooth' })
                } else {
                  document.getElementById('live-wall')?.scrollIntoView({ behavior: 'smooth' })
                }
              }}
            />

            {raceFirst && (
              <div className="race-wrap">
                <FireRace
                  first={raceFirst}
                  second={raceSecond}
                  frozen={wall.frozen}
                  remainingMs={remainingMs}
                  reacted={viewer.reactedIds.includes(raceFirst.id)}
                  onReact={handleReact}
                  onShare={setShareMessage}
                  onKnockOff={() => startCreate(COMPETITION_TEMPLATES[0])}
                  onChase={() => {
                    setMode('trending')
                    document.getElementById('live-wall')?.scrollIntoView({ behavior: 'smooth' })
                    if (raceSecond) focusMessage(raceSecond.id, 'trending')
                  }}
                />
              </div>
            )}

            <div className="loops-wrap">
              <FriendsLoopRail
                messages={wall.messages}
                frozen={wall.frozen}
                reactedIds={viewer.reactedIds}
                onReact={handleReact}
                onShare={setShareMessage}
              />
              <StreamerDeck messages={wall.messages} onShare={setShareMessage} />
            </div>

            {wall.frozen && finalePhase === 'done' && <ScarcityEditions />}

            <PsychologyMap frozen={wall.frozen} />

            <ViralLoopsMap />

            <section className="wall-section" id="live-wall">
              <div className="wall-head">
                <div>
                  <h2>{wall.frozen ? 'Time capsule' : PSYCH_COPY.wallLive}</h2>
                  <p>
                    {wall.frozen
                      ? `Frozen forever · ${edition} · Nothing changes. Browse, search, share, certify.`
                      : PSYCH_COPY.wallLiveSub}
                  </p>
                </div>
                <div className="wall-controls">
                  <Countdown
                    remainingMs={remainingMs}
                    frozen={wall.frozen}
                    compact
                    showMantra
                  />
                </div>
              </div>

              <WallExplorer
                mode={mode}
                onModeChange={setMode}
                live={live}
                trending={trending}
                ranked={ranked}
                allMessages={wall.messages}
                frozen={wall.frozen}
                finalRankingIds={wall.finalRankingIds}
                scoreAt={wall.endsAt}
                reactedIds={viewer.reactedIds}
                myMessageIds={viewer.myMessageIds}
                highlightId={highlightId}
                query={query}
                onQueryChange={setQuery}
                filterMine={filterMine}
                onToggleMine={() => setFilterMine((v) => !v)}
                hasMine={myMessages.length > 0}
                onCertificate={() => {
                  if (myMessages[0]) {
                    setCertMessageId(myMessages[0].id)
                    setCertOpen(true)
                  }
                }}
                onReact={handleReact}
                onShare={setShareMessage}
                onReport={setReportMessage}
                exploreHint={
                  wall.frozen ? PSYCH_COPY.exploreFrozen : PSYCH_COPY.exploreLive
                }
                remainingMs={remainingMs}
              />
            </section>
          </div>

          <PreviousWalls
            liveTitle={`The Wall — ${edition}`}
            liveDateLabel={edition.toUpperCase()}
            liveVoices={messageCount}
            liveReactions={stats.reactionCount}
            frozen={wall.frozen}
            onJoin={() => startCreate()}
            onExploreLive={() => {
              document.getElementById('live-wall')?.scrollIntoView({ behavior: 'smooth' })
            }}
          />
        </div>
      )}

      <ReactionToast
        message={reactToast}
        challengeRequired={challengeOpen}
        onDismiss={() => setReactToast(null)}
        onChallengeSolved={() => {
          setChallengeOpen(false)
          setReactToast('You’re verified — keep reacting. Still no account.')
        }}
      />

      {!wall.frozen && !wall.submissionsPaused && (
        <div className="sticky-invite" role="region" aria-label="Leave a message">
          <Countdown
            remainingMs={remainingMs}
            frozen={wall.frozen}
            compact
            showMantra
            tone="on-dark"
          />
          <p>
            {PSYCH_COPY.belongStickyTitle}
            <span>{PSYCH_COPY.belongStickyFomo}</span>
          </p>
          <button type="button" className="btn primary" onClick={() => startCreate()}>
            {PSYCH_COPY.belongCta}
          </button>
        </div>
      )}

      <footer className="site-foot">
        <div>
          <strong>THE WALL</strong>
          <span>{MARKETING_LINE}</span>
          <p className="foot-positioning">{PRODUCT_POSITIONING}</p>
        </div>
        <div className="demo-tools" aria-label="Prototype controls">
          <span>Demo</span>
          <button type="button" onClick={() => demoEndIn(60_000)}>
            End in 60s
          </button>
          <button type="button" onClick={triggerFinale}>
            Trigger finale
          </button>
          <button type="button" onClick={restartDemo}>
            New 24h wall
          </button>
          <button type="button" onClick={() => setAdminOpen(true)}>
            Admin dashboard
          </button>
        </div>
      </footer>

      <Finale
        remainingMs={remainingMs}
        frozen={wall.frozen}
        stats={stats}
        hasMine={myMessages.length > 0}
        phase={finalePhase}
        onPhase={setPhase}
        onExplore={() => {
          document.getElementById('live-wall')?.scrollIntoView({ behavior: 'smooth' })
        }}
        onFindMine={() => {
          if (myMessages[0]) focusMessage(myMessages[0].id, 'live')
          else document.getElementById('live-wall')?.scrollIntoView({ behavior: 'smooth' })
        }}
        onCertificate={() => {
          if (myMessages[0]) {
            setCertMessageId(myMessages[0].id)
            setCertOpen(true)
          }
        }}
      />

      {!wall.frozen && !wall.submissionsPaused && (
        <CreateMessageModal
          open={createOpen}
          onClose={() => {
            setCreateOpen(false)
            setComposeSeed('')
          }}
          edition={edition}
          nextNumber={wall.nextNumber}
          initialText={composeSeed}
          existingMessages={wall.messages}
          remainingMs={remainingMs}
          frozen={wall.frozen}
          onCreate={(text, payment) => postMessage(text, payment)}
          onViewMessage={(id) => focusMessage(id, 'live')}
        />
      )}
      <Certificate
        open={certOpen}
        onClose={() => setCertOpen(false)}
        message={certMessage}
        rank={certRank}
        frozen={wall.frozen}
        wallDate={wallDate}
        totalMessages={messageCount}
        remainingMs={remainingMs}
      />
      <ShareMessageModal
        open={Boolean(shareMessage)}
        message={shareMessage}
        wallDate={wallDate}
        rank={shareRank || undefined}
        frozen={wall.frozen}
        remainingMs={remainingMs}
        onClose={() => setShareMessage(null)}
      />
      <ReportMessageModal
        open={Boolean(reportMessage)}
        message={reportMessage}
        reporterSessionId={viewer.viewerKey}
        onClose={() => setReportMessage(null)}
      />
      <AdminDashboard
        open={adminOpen}
        wall={wall}
        remainingMs={remainingMs}
        onClose={() => setAdminOpen(false)}
        onWallChange={applyWall}
        onPauseSubmissions={setSubmissionsPaused}
        onEndEvent={() => {
          endEventNow()
          setPhase('monument')
        }}
      />
    </div>
  )
}

export default App
