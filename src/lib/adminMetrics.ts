import type { WallState } from '../types'
import { loadPrivateLedger } from './privateLedger'
import { loadModerationOps } from './moderationOps'
import { totalReactionPulsesInWindow } from './reactionPulse'
import { loadDeviceVelocitySnapshot } from './deviceVelocity'
import { isRemovedMessage } from './moderation'
import { formatCountdown } from './format'

export type AdminStatus = 'LIVE' | 'PAUSED' | 'CLOSED'

export type AdminDashboardStats = {
  status: AdminStatus
  timeRemainingLabel: string
  remainingMs: number
  messages: number
  reactions: number
  revenueUsd: number
  activeUsers: number
  messagesPerMin: number
  reactionsPerMin: number
  paidMessages: number
  openReports: number
  removals: number
  submissionsPaused: boolean
}

export type SuspiciousItem = {
  id: string
  severity: 'high' | 'medium' | 'low'
  label: string
  detail: string
}

export function adminStatus(wall: WallState): AdminStatus {
  if (wall.frozen) return 'CLOSED'
  if (wall.submissionsPaused) return 'PAUSED'
  return 'LIVE'
}

export function computeAdminStats(
  wall: WallState,
  now = Date.now(),
): AdminDashboardStats {
  const remainingMs = Math.max(0, wall.endsAt - now)
  const messages = Math.max(0, wall.nextNumber - 1)
  const reactions = wall.messages.reduce((s, m) => s + m.reactions, 0)
  const ledger = loadPrivateLedger()
  const paidMessages = ledger.records.length
  // $1 per etched paid message; seed genesis excluded from revenue
  const revenueUsd = paidMessages
  const ops = loadModerationOps()
  const openReports = ops.reports.filter((r) => r.status === 'open').length
  const minuteAgo = now - 60_000
  const messagesPerMin = wall.messages.filter((m) => m.createdAt >= minuteAgo).length
  const reactionsPerMin = totalReactionPulsesInWindow(now, 60_000)

  return {
    status: adminStatus(wall),
    timeRemainingLabel: formatCountdown(remainingMs).label,
    remainingMs,
    messages,
    reactions,
    revenueUsd,
    activeUsers: wall.viewerCount,
    messagesPerMin,
    reactionsPerMin,
    paidMessages,
    openReports,
    removals: ops.removals.length,
    submissionsPaused: Boolean(wall.submissionsPaused),
  }
}

export function listSuspiciousActivity(wall: WallState, now = Date.now()): SuspiciousItem[] {
  const items: SuspiciousItem[] = []
  const velocity = loadDeviceVelocitySnapshot()
  const ops = loadModerationOps()
  const ledger = loadPrivateLedger()

  if (velocity.lockedUntil > now) {
    const mins = Math.ceil((velocity.lockedUntil - now) / 60_000)
    items.push({
      id: 'device-lock',
      severity: 'high',
      label: 'Device lockout active',
      detail: `Local operator browser is locked for ~${mins}m after velocity / captcha abuse.`,
    })
  }

  const hourAgo = now - 60 * 60_000
  const payAttempts = velocity.events.filter(
    (e) => e.kind === 'payment_attempt' && e.at >= hourAgo,
  ).length
  if (payAttempts >= 5) {
    items.push({
      id: 'pay-velocity',
      severity: 'medium',
      label: 'Elevated payment attempts',
      detail: `${payAttempts} payment attempts from this device in the last hour.`,
    })
  }

  const captchaFails = velocity.events.filter(
    (e) => e.kind === 'captcha_fail' && e.at >= hourAgo,
  ).length
  if (captchaFails >= 2) {
    items.push({
      id: 'captcha-fails',
      severity: 'medium',
      label: 'CAPTCHA failures',
      detail: `${captchaFails} Turnstile / demo captcha failures in the last hour.`,
    })
  }

  const reportBurst = new Map<number, number>()
  for (const r of ops.reports.filter((x) => x.status === 'open')) {
    reportBurst.set(r.messageNumber, (reportBurst.get(r.messageNumber) ?? 0) + 1)
  }
  for (const [num, count] of reportBurst) {
    if (count >= 2) {
      items.push({
        id: `reports-${num}`,
        severity: 'high',
        label: `Clustered reports on #${String(num).padStart(6, '0')}`,
        detail: `${count} open reports — review for removal.`,
      })
    }
  }

  const walletCounts = new Map<string, number>()
  for (const r of ledger.records) {
    walletCounts.set(r.payerWallet, (walletCounts.get(r.payerWallet) ?? 0) + 1)
  }
  for (const [wallet, count] of walletCounts) {
    if (count >= 3) {
      items.push({
        id: `wallet-${wallet}`,
        severity: 'medium',
        label: 'Wallet farming pattern',
        detail: `${wallet.slice(0, 6)}…${wallet.slice(-4)} etched ${count} paid messages.`,
      })
    }
  }

  const removed = wall.messages.filter(isRemovedMessage).length
  if (removed > 0) {
    items.push({
      id: 'tombstones',
      severity: 'low',
      label: 'Tombstoned messages',
      detail: `${removed} messages currently show [Removed by moderation].`,
    })
  }

  if (items.length === 0) {
    items.push({
      id: 'clear',
      severity: 'low',
      label: 'No active alerts',
      detail: 'Velocity, reports, and payment patterns look nominal.',
    })
  }

  return items
}

export function buildAdminDatabaseExport(wall: WallState) {
  return {
    exportedAt: new Date().toISOString(),
    wall,
    privateLedger: loadPrivateLedger(),
    moderationOps: loadModerationOps(),
    deviceVelocity: loadDeviceVelocitySnapshot(),
    note: 'Operator export — contains private payment & moderation fields. Do not publish.',
  }
}

export function downloadAdminDatabase(wall: WallState) {
  const payload = JSON.stringify(buildAdminDatabaseExport(wall), null, 2)
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `the-wall-admin-db-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}
