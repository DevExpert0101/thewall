import { useEffect, useMemo, useState } from 'react'
import type { WallState } from '../types'
import { formatMessageNumber } from '../lib/format'
import { isRemovedMessage } from '../lib/moderation'
import {
  emergencyRemoveMessage,
  loadModerationOps,
  openReportCount,
  resolveReport,
  verifyAdminKey,
  type MessageReport,
} from '../lib/moderationOps'
import { loadPrivateLedger } from '../lib/privateLedger'
import { cryptoConfig } from '../lib/cryptoPayment'
import {
  computeAdminStats,
  downloadAdminDatabase,
  listSuspiciousActivity,
} from '../lib/adminMetrics'
import {
  downloadHtmlArchive,
  downloadJsonArchive,
  openPdfCollectible,
  wallStats,
} from '../lib/archive'
import { loadDeviceVelocitySnapshot } from '../lib/deviceVelocity'

type Tab =
  | 'overview'
  | 'messages'
  | 'reports'
  | 'payments'
  | 'traffic'
  | 'controls'

type Props = {
  open: boolean
  wall: WallState
  remainingMs: number
  onClose: () => void
  onWallChange: (wall: WallState) => void
  onPauseSubmissions: (paused: boolean) => void
  onEndEvent: () => void
}

export function AdminDashboard({
  open,
  wall,
  remainingMs,
  onClose,
  onWallChange,
  onPauseSubmissions,
  onEndEvent,
}: Props) {
  const [key, setKey] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [now, setNow] = useState(() => Date.now())
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reason, setReason] = useState('Policy violation')
  const [note, setNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [reports, setReports] = useState<MessageReport[]>([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!open) {
      setKey('')
      setAuthed(false)
      setAuthError(null)
      setTab('overview')
      setQuery('')
      setSelectedId(null)
      setReason('Policy violation')
      setNote('')
      setActionError(null)
      setFlash(null)
      return
    }
    refreshReports()
  }, [open, wall.messages])

  useEffect(() => {
    if (!open || !authed) return
    const id = window.setInterval(() => {
      setNow(Date.now())
      setTick((t) => t + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [open, authed])

  const stats = useMemo(
    () => computeAdminStats(wall, now),
    // tick forces rate refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wall, now, tick],
  )

  const suspicious = useMemo(
    () => listSuspiciousActivity(wall, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wall, now, tick, reports],
  )

  const payments = useMemo(() => loadPrivateLedger().records, [wall.messages, tick])
  const velocity = useMemo(() => loadDeviceVelocitySnapshot(), [tick, open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = [...wall.messages].sort((a, b) => b.number - a.number)
    if (!q) return list.slice(0, 50)
    return list
      .filter(
        (m) =>
          String(m.number).includes(q) ||
          m.text.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q),
      )
      .slice(0, 50)
  }, [wall.messages, query])

  const selected = wall.messages.find((m) => m.id === selectedId) ?? null
  const wallDate = useMemo(() => new Date(wall.startedAt), [wall.startedAt])
  const artifactStats = useMemo(() => wallStats(wall, wallDate), [wall, wallDate])

  if (!open) return null

  function refreshReports() {
    setReports(loadModerationOps().reports.filter((r) => r.status === 'open'))
  }

  function tryAuth() {
    setAuthError(null)
    if (!verifyAdminKey(key)) {
      setAuthError('Invalid admin key.')
      setAuthed(false)
      return
    }
    setAuthed(true)
  }

  function removeSelected() {
    if (!selected || !authed) return
    setActionError(null)
    try {
      const { wall: next, removal } = emergencyRemoveMessage({
        wall,
        messageId: selected.id,
        reason,
        operatorNote: note,
        adminKey: key,
      })
      onWallChange(next)
      refreshReports()
      setFlash(`Removed ${formatMessageNumber(removal.messageNumber)}.`)
      setSelectedId(null)
      setNote('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Removal failed.')
    }
  }

  return (
    <div className="modal-root admin-root" role="dialog" aria-modal="true" aria-labelledby="admin-dash-title">
      <button type="button" className="modal-backdrop" aria-label="Close" onClick={onClose} />
      <div className="admin-dashboard">
        <header className="admin-dash-head">
          <div>
            <p className="admin-dash-kicker">Operations</p>
            <h2 id="admin-dash-title">THE WALL ADMIN</h2>
          </div>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </header>

        {!authed ? (
          <div className="admin-auth">
            <p>Operator key required. Client prototype — use real auth in production.</p>
            <label className="admin-key">
              <span>Admin key</span>
              <input
                type="password"
                value={key}
                autoComplete="off"
                placeholder="VITE_ADMIN_KEY"
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') tryAuth()
                }}
              />
            </label>
            {authError && <p className="pay-error">{authError}</p>}
            <button type="button" className="btn primary wide" onClick={tryAuth}>
              Enter dashboard
            </button>
          </div>
        ) : (
          <>
            <div className={`admin-status-banner status-${stats.status.toLowerCase()}`}>
              <span>
                Status: <strong>{stats.status}</strong>
              </span>
              <span>
                Time remaining: <strong>{stats.timeRemainingLabel}</strong>
              </span>
              {stats.submissionsPaused && <span className="admin-pill">Submissions paused</span>}
            </div>

            <dl className="admin-kpi-grid">
              <div>
                <dt>Messages</dt>
                <dd>{stats.messages.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Reactions</dt>
                <dd>{stats.reactions.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Revenue</dt>
                <dd>${stats.revenueUsd.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Active users</dt>
                <dd>{stats.activeUsers.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Messages/min</dt>
                <dd>{stats.messagesPerMin.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Reactions/min</dt>
                <dd>{stats.reactionsPerMin.toLocaleString()}</dd>
              </div>
            </dl>

            <nav className="admin-tabs" aria-label="Admin sections">
              {(
                [
                  ['overview', 'Overview'],
                  ['messages', 'Messages'],
                  ['reports', 'Reports'],
                  ['payments', 'Payments'],
                  ['traffic', 'Traffic'],
                  ['controls', 'Controls'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={tab === id ? 'on' : ''}
                  onClick={() => setTab(id)}
                >
                  {label}
                  {id === 'reports' && stats.openReports > 0 ? ` (${stats.openReports})` : ''}
                </button>
              ))}
            </nav>

            <div className="admin-tab-body">
              {tab === 'overview' && (
                <section>
                  <h3>Suspicious activity</h3>
                  <ul className="admin-suspect-list">
                    {suspicious.map((s) => (
                      <li key={s.id} className={`sev-${s.severity}`}>
                        <strong>{s.label}</strong>
                        <span>{s.detail}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="admin-meta-line">
                    Paid etches: {stats.paidMessages.toLocaleString()} · Removals:{' '}
                    {stats.removals.toLocaleString()} · Open reports:{' '}
                    {stats.openReports.toLocaleString()} · Clock skew remaining{' '}
                    {Math.round(remainingMs / 1000)}s
                  </p>
                </section>
              )}

              {tab === 'messages' && (
                <section>
                  <h3>Search messages</h3>
                  <label className="admin-key">
                    <span>Number or text</span>
                    <input
                      value={query}
                      placeholder="Search The Wall"
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <ul className="admin-msg-list">
                    {filtered.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          className={selectedId === m.id ? 'on' : ''}
                          disabled={isRemovedMessage(m)}
                          onClick={() => setSelectedId(m.id)}
                        >
                          <strong>{formatMessageNumber(m.number)}</strong>
                          <span>
                            {isRemovedMessage(m)
                              ? 'Already removed'
                              : m.text.length > 72
                                ? `${m.text.slice(0, 70)}…`
                                : m.text}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>

                  {selected && !isRemovedMessage(selected) && (
                    <div className="admin-remove-box">
                      <p className="admin-selected-quote">“{selected.text}”</p>
                      <label className="admin-key">
                        <span>Removal reason</span>
                        <input
                          value={reason}
                          maxLength={200}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </label>
                      <label className="admin-key">
                        <span>Operator note (private)</span>
                        <textarea
                          value={note}
                          rows={2}
                          maxLength={400}
                          onChange={(e) => setNote(e.target.value)}
                        />
                      </label>
                      {actionError && <p className="pay-error">{actionError}</p>}
                      <button type="button" className="btn danger wide" onClick={removeSelected}>
                        Remove message
                      </button>
                    </div>
                  )}
                  {flash && <p className="admin-flash">{flash}</p>}
                </section>
              )}

              {tab === 'reports' && (
                <section>
                  <h3>Review reports</h3>
                  {reports.length === 0 ? (
                    <p className="admin-empty">No open reports.</p>
                  ) : (
                    <ul className="admin-report-review">
                      {reports.map((r) => {
                        const msg = wall.messages.find((m) => m.id === r.messageId)
                        return (
                          <li key={r.id}>
                            <div>
                              <strong>
                                {formatMessageNumber(r.messageNumber)} · {r.reason}
                              </strong>
                              <span>
                                {msg
                                  ? isRemovedMessage(msg)
                                    ? '[Already removed]'
                                    : `“${msg.text}”`
                                  : 'Message missing'}
                              </span>
                              {r.note && <span className="admin-report-note">Note: {r.note}</span>}
                              <span className="admin-report-meta">
                                {openReportCount(r.messageId)} open ·{' '}
                                {new Date(r.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <div className="admin-report-actions">
                              <button
                                type="button"
                                className="btn ghost"
                                onClick={() => {
                                  setTab('messages')
                                  setSelectedId(r.messageId)
                                  setQuery(String(r.messageNumber))
                                }}
                              >
                                Open
                              </button>
                              <button
                                type="button"
                                className="btn ghost"
                                onClick={() => {
                                  resolveReport(r.id)
                                  refreshReports()
                                  setFlash(`Resolved report on ${formatMessageNumber(r.messageNumber)}.`)
                                }}
                              >
                                Dismiss
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              )}

              {tab === 'payments' && (
                <section>
                  <h3>Payment status</h3>
                  <p className="admin-meta-line">
                    Chain {cryptoConfig.chain.name} · Treasury{' '}
                    {shortAddr(cryptoConfig.treasuryAddress)} · Required{' '}
                    {cryptoConfig.paymentLabel}
                  </p>
                  {payments.length === 0 ? (
                    <p className="admin-empty">No confirmed payments in the private ledger yet.</p>
                  ) : (
                    <ul className="admin-pay-list">
                      {payments.slice(0, 40).map((p) => (
                        <li key={p.id}>
                          <strong>{formatMessageNumber(p.messageNumber)}</strong>
                          <span>{shortAddr(p.payerWallet)}</span>
                          <span className="ok">confirmed</span>
                          <a
                            href={cryptoConfig.explorerTx(p.txHash)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {p.txHash.slice(0, 10)}…
                          </a>
                          <span>{new Date(p.confirmedAt).toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {tab === 'traffic' && (
                <section>
                  <h3>Monitor traffic</h3>
                  <dl className="admin-traffic-grid">
                    <div>
                      <dt>Viewers (active users)</dt>
                      <dd>{stats.activeUsers.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Messages / min</dt>
                      <dd>{stats.messagesPerMin}</dd>
                    </div>
                    <div>
                      <dt>Reactions / min</dt>
                      <dd>{stats.reactionsPerMin}</dd>
                    </div>
                    <div>
                      <dt>Device events (24h buffer)</dt>
                      <dd>{velocity.events.length}</dd>
                    </div>
                  </dl>
                  <h4>Recent device velocity</h4>
                  <ul className="admin-velocity-list">
                    {[...velocity.events]
                      .slice(-20)
                      .reverse()
                      .map((e, i) => (
                        <li key={`${e.at}-${i}`}>
                          <strong>{e.kind}</strong>
                          <span>{new Date(e.at).toLocaleTimeString()}</span>
                          {e.meta && <span>{e.meta}</span>}
                        </li>
                      ))}
                  </ul>
                </section>
              )}

              {tab === 'controls' && (
                <section className="admin-controls">
                  <h3>Event controls</h3>
                  <div className="admin-control-row">
                    <div>
                      <strong>Pause submissions</strong>
                      <p>Blocks new $1 etches. Browse / react stay up unless frozen.</p>
                    </div>
                    <button
                      type="button"
                      className={`btn ${wall.submissionsPaused ? 'primary' : 'ghost'}`}
                      disabled={wall.frozen}
                      onClick={() => {
                        onPauseSubmissions(!wall.submissionsPaused)
                        setFlash(
                          wall.submissionsPaused
                            ? 'Submissions resumed.'
                            : 'Submissions paused.',
                        )
                      }}
                    >
                      {wall.submissionsPaused ? 'Resume submissions' : 'Pause submissions'}
                    </button>
                  </div>

                  <div className="admin-control-row">
                    <div>
                      <strong>End event manually</strong>
                      <p>Freeze The Wall now, lock ranks, run museum mode.</p>
                    </div>
                    <button
                      type="button"
                      className="btn danger"
                      disabled={wall.frozen}
                      onClick={() => {
                        if (
                          window.confirm(
                            'End The Wall now? This freezes messages and locks ranking.',
                          )
                        ) {
                          onEndEvent()
                          setFlash('Event ended. The Wall is closed.')
                        }
                      }}
                    >
                      End event now
                    </button>
                  </div>

                  <div className="admin-control-row">
                    <div>
                      <strong>Export database</strong>
                      <p>Wall + private ledger + reports + velocity (operator only).</p>
                    </div>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => {
                        downloadAdminDatabase(wall)
                        setFlash('Admin database exported.')
                      }}
                    >
                      Export JSON
                    </button>
                  </div>

                  <div className="admin-control-row">
                    <div>
                      <strong>Generate final archive</strong>
                      <p>Public HTML / JSON / PDF collectible artifacts.</p>
                    </div>
                    <div className="admin-archive-actions">
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => {
                          downloadHtmlArchive(wall, artifactStats)
                          setFlash('HTML archive generated.')
                        }}
                      >
                        HTML archive
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => {
                          downloadJsonArchive(wall, artifactStats)
                          setFlash('JSON archive generated.')
                        }}
                      >
                        JSON archive
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => openPdfCollectible(wall, artifactStats)}
                      >
                        PDF collectible
                      </button>
                    </div>
                  </div>

                  {flash && <p className="admin-flash">{flash}</p>}
                </section>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
