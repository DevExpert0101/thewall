import { useEffect, useMemo, useState } from 'react'
import type { WallMessage } from '../types'
import { formatFire, formatMessageNumber } from '../lib/format'
import {
  MUSEUM_SORT_LABELS,
  searchWallMessages,
  sortMuseumMessages,
  type MuseumSort,
} from '../lib/museumSearch'
import { MessageRow } from './MessageRow'
import { Countdown } from './Countdown'

export type WallMode = 'live' | 'trending' | 'random'

type Props = {
  mode: WallMode
  onModeChange: (mode: WallMode) => void
  live: WallMessage[]
  trending: WallMessage[]
  ranked: WallMessage[]
  allMessages: WallMessage[]
  frozen: boolean
  finalRankingIds?: string[]
  scoreAt: number
  reactedIds: string[]
  myMessageIds: string[]
  highlightId: string | null
  query: string
  onQueryChange: (q: string) => void
  filterMine: boolean
  onToggleMine: () => void
  hasMine: boolean
  onCertificate: () => void
  onReact: (id: string) => void
  onShare: (message: WallMessage) => void
  onReport: (message: WallMessage) => void
  exploreHint: string
  remainingMs: number
}

function filterLive(
  list: WallMessage[],
  query: string,
  filterMine: boolean,
  myMessageIds: string[],
): WallMessage[] {
  let out = filterMine ? list.filter((m) => myMessageIds.includes(m.id)) : list
  return searchWallMessages(out, query)
}

export function WallExplorer({
  mode,
  onModeChange,
  live,
  trending,
  ranked,
  allMessages,
  frozen,
  finalRankingIds,
  scoreAt,
  reactedIds,
  myMessageIds,
  highlightId,
  query,
  onQueryChange,
  filterMine,
  onToggleMine,
  hasMine,
  onCertificate,
  onReact,
  onShare,
  onReport,
  exploreHint,
  remainingMs,
}: Props) {
  const [randomId, setRandomId] = useState<string | null>(null)
  const [museumSort, setMuseumSort] = useState<MuseumSort>('trending')
  const [randomSeed, setRandomSeed] = useState(0)

  const museumResults = useMemo(() => {
    let list = searchWallMessages(allMessages, query)
    if (filterMine) list = list.filter((m) => myMessageIds.includes(m.id))
    if (museumSort === 'random') {
      // re-shuffle when seed bumps
      void randomSeed
    }
    return sortMuseumMessages(list, museumSort, { finalRankingIds, scoreAt })
  }, [
    allMessages,
    query,
    filterMine,
    myMessageIds,
    museumSort,
    finalRankingIds,
    scoreAt,
    randomSeed,
  ])

  const pool = useMemo(() => {
    const base = mode === 'live' ? live : trending
    return filterLive(base, query, filterMine, myMessageIds)
  }, [mode, live, trending, query, filterMine, myMessageIds])

  const randomPool = useMemo(
    () => filterLive(ranked, query, filterMine, myMessageIds),
    [ranked, query, filterMine, myMessageIds],
  )

  const randomMessage =
    (randomId && randomPool.find((m) => m.id === randomId)) || randomPool[0] || null

  function pickRandom(avoidId?: string | null) {
    if (randomPool.length === 0) return
    let next = randomPool[Math.floor(Math.random() * randomPool.length)]
    if (randomPool.length > 1 && avoidId && next.id === avoidId) {
      next = randomPool[Math.floor(Math.random() * randomPool.length)]
    }
    setRandomId(next.id)
    requestAnimationFrame(() => {
      document.getElementById('random-spotlight')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })
  }

  useEffect(() => {
    if (frozen || mode !== 'random') return
    if (!randomId || !randomPool.some((m) => m.id === randomId)) {
      if (randomPool.length > 0) {
        setRandomId(randomPool[Math.floor(Math.random() * randomPool.length)].id)
      }
    }
  }, [mode, randomId, randomPool, frozen])

  if (frozen) {
    return (
      <div className="wall-explorer museum">
        <div className="museum-clock">
          <Countdown remainingMs={remainingMs} frozen showMantra compact />
        </div>
        <p className="museum-badge">
          The Wall froze. Nothing changes. Permanent digital time capsule.
        </p>
        <h3 className="museum-search-title">Search the capsule</h3>
        <label className="search-field museum-search">
          <span className="sr-only">Search The Wall</span>
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="love"
            autoComplete="off"
          />
        </label>
        <p className="museum-result-count" aria-live="polite">
          {museumResults.length.toLocaleString()} result
          {museumResults.length === 1 ? '' : 's'}
        </p>

        <div className="museum-filters" role="group" aria-label="Sort results">
          {(Object.keys(MUSEUM_SORT_LABELS) as MuseumSort[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`chip ${museumSort === key ? 'on' : ''}`}
              onClick={() => {
                setMuseumSort(key)
                if (key === 'random') setRandomSeed((n) => n + 1)
              }}
            >
              {MUSEUM_SORT_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="explore-actions museum-actions">
          {hasMine && (
            <button
              type="button"
              className={`chip ${filterMine ? 'on' : ''}`}
              onClick={onToggleMine}
            >
              {filterMine ? 'Show all' : 'My messages'}
            </button>
          )}
          {hasMine && (
            <button type="button" className="chip accent" onClick={onCertificate}>
              Certificate
            </button>
          )}
        </div>
        <p className="explore-hint">{exploreHint}</p>

        <div className="wall-list mode-museum" role="feed" aria-label="Archive search results">
          {museumResults.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              rank={ranked.findIndex((r) => r.id === m.id) + 1}
              reacted={reactedIds.includes(m.id)}
              mine={myMessageIds.includes(m.id)}
              frozen
              museum
              highlight={highlightId === m.id}
              variant="live"
              onReact={onReact}
              onShare={onShare}
              onReport={onReport}
            />
          ))}
          {museumResults.length === 0 && (
            <p className="empty">
              {query.trim()
                ? 'No voices matched. Try another word or message number.'
                : 'The archive is empty.'}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="wall-explorer">
      <div className="mode-tabs" role="tablist" aria-label="Wall modes">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'live'}
          className={`mode-tab ${mode === 'live' ? 'on' : ''}`}
          onClick={() => onModeChange('live')}
        >
          Live
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'trending'}
          className={`mode-tab ${mode === 'trending' ? 'on' : ''}`}
          onClick={() => onModeChange('trending')}
        >
          🔥 Trending
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'random'}
          className={`mode-tab ${mode === 'random' ? 'on' : ''}`}
          onClick={() => onModeChange('random')}
        >
          Random
        </button>
        <div className="mode-clock">
          <Countdown remainingMs={remainingMs} frozen={frozen} compact showMantra />
        </div>
      </div>

      <p className="mode-blurb">
        {mode === 'live' && 'Chronological stream — you only have today.'}
        {mode === 'trending' &&
          'Race for #1 while the clock burns. Velocity × quality × time — late explosions can still win.'}
        {mode === 'random' && 'Discovery mode — jump somewhere unexpected before freeze.'}
      </p>

      <div className="explore-bar">
        <label className="search-field">
          <span className="sr-only">Search messages</span>
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search text or #000042…"
            autoComplete="off"
          />
        </label>
        <div className="explore-actions">
          {hasMine && (
            <button
              type="button"
              className={`chip ${filterMine ? 'on' : ''}`}
              onClick={onToggleMine}
            >
              {filterMine ? 'Show all' : 'My messages'}
            </button>
          )}
          {hasMine && (
            <button type="button" className="chip" onClick={onCertificate}>
              Certificate
            </button>
          )}
          {mode === 'random' && (
            <button
              type="button"
              className="chip accent"
              onClick={() => pickRandom(randomMessage?.id)}
            >
              Surprise me
            </button>
          )}
        </div>
        <p className="explore-hint">{exploreHint}</p>
      </div>

      {mode === 'random' ? (
        <div className="random-stage" id="random-spotlight">
          {randomMessage ? (
            <>
              <p className="random-kicker">Random find</p>
              <p className="random-serial">{formatMessageNumber(randomMessage.number)}</p>
              <blockquote className="random-quote">“{randomMessage.text}”</blockquote>
              <div className="random-meta">
                <span>Anonymous</span>
                <span>🔥 {formatFire(randomMessage.reactions)}</span>
                <span>
                  Live #{ranked.findIndex((r) => r.id === randomMessage.id) + 1 || '—'}
                </span>
              </div>
              <div className="random-actions">
                <button
                  type="button"
                  className="fire-btn on-stage"
                  disabled={reactedIds.includes(randomMessage.id) || frozen}
                  onClick={() => onReact(randomMessage.id)}
                >
                  <span aria-hidden="true">🔥</span>
                  <span>
                    {reactedIds.includes(randomMessage.id) ? 'Reacted' : 'React'}
                  </span>
                </button>
                <button type="button" className="btn ghost" onClick={() => onShare(randomMessage)}>
                  Share
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => onReport(randomMessage)}
                >
                  Report
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => pickRandom(randomMessage.id)}
                >
                  Another random
                </button>
              </div>
            </>
          ) : (
            <p className="empty">No messages to discover yet.</p>
          )}
        </div>
      ) : (
        <div
          className={`wall-list mode-${mode}`}
          role="feed"
          aria-label={mode === 'live' ? 'Live messages' : 'Trending messages'}
        >
          {pool.map((m, i) => (
            <MessageRow
              key={m.id}
              message={m}
              rank={ranked.findIndex((r) => r.id === m.id) + 1}
              reacted={reactedIds.includes(m.id)}
              mine={myMessageIds.includes(m.id)}
              frozen={false}
              highlight={highlightId === m.id}
              variant={mode === 'trending' ? 'trending' : 'live'}
              trendingPlace={mode === 'trending' ? i + 1 : undefined}
              onReact={onReact}
              onShare={onShare}
              onReport={onReport}
            />
          ))}
          {pool.length === 0 && (
            <p className="empty">
              {query.trim()
                ? 'Nothing matches that search. Try another word or message number.'
                : 'No messages here yet.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
