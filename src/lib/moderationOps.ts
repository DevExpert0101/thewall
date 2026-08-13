import type { ReportReason } from './moderation'
import { REMOVED_PLACEHOLDER } from './moderation'
import type { WallMessage, WallState } from '../types'

const OPS_KEY = 'the-wall:mod-ops:v1'

export type MessageReport = {
  id: string
  messageId: string
  messageNumber: number
  reason: ReportReason
  note: string
  reporterSessionId: string
  createdAt: number
  status: 'open' | 'resolved'
}

export type AdminRemoval = {
  id: string
  messageId: string
  messageNumber: number
  previousText: string
  reason: string
  removedAt: number
  operatorNote: string
}

export type ModerationOps = {
  reports: MessageReport[]
  removals: AdminRemoval[]
}

function emptyOps(): ModerationOps {
  return { reports: [], removals: [] }
}

export function loadModerationOps(): ModerationOps {
  const raw = localStorage.getItem(OPS_KEY)
  if (!raw) return emptyOps()
  try {
    const parsed = JSON.parse(raw) as ModerationOps
    return {
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      removals: Array.isArray(parsed.removals) ? parsed.removals : [],
    }
  } catch {
    return emptyOps()
  }
}

function saveOps(ops: ModerationOps): void {
  localStorage.setItem(OPS_KEY, JSON.stringify(ops))
}

export function clearModerationOps(): void {
  localStorage.removeItem(OPS_KEY)
}

export function alreadyReported(
  messageId: string,
  reporterSessionId: string,
): boolean {
  return loadModerationOps().reports.some(
    (r) =>
      r.messageId === messageId &&
      r.reporterSessionId === reporterSessionId &&
      r.status === 'open',
  )
}

export function submitReport(input: {
  message: WallMessage
  reason: ReportReason
  note?: string
  reporterSessionId: string
}): MessageReport {
  const ops = loadModerationOps()
  if (alreadyReported(input.message.id, input.reporterSessionId)) {
    throw new Error('You already reported this message from this device.')
  }

  const report: MessageReport = {
    id: `rep_${Date.now().toString(36)}`,
    messageId: input.message.id,
    messageNumber: input.message.number,
    reason: input.reason,
    note: (input.note ?? '').trim().slice(0, 280),
    reporterSessionId: input.reporterSessionId,
    createdAt: Date.now(),
    status: 'open',
  }

  saveOps({ ...ops, reports: [report, ...ops.reports] })
  return report
}

export function openReportCount(messageId: string): number {
  return loadModerationOps().reports.filter(
    (r) => r.messageId === messageId && r.status === 'open',
  ).length
}

export function resolveReport(reportId: string): void {
  const ops = loadModerationOps()
  saveOps({
    ...ops,
    reports: ops.reports.map((r) =>
      r.id === reportId ? { ...r, status: 'resolved' as const } : r,
    ),
  })
}

/** Verify operator key from env. Never trust client-only auth in production. */
export function verifyAdminKey(key: string): boolean {
  const expected = (import.meta.env.VITE_ADMIN_KEY as string | undefined)?.trim()
  if (!expected) {
    // Prototype fallback — documented in .env.example
    return key.trim() === 'wall-emergency'
  }
  return key.trim() === expected
}

/**
 * Emergency removal: tombstone the public message, keep the forever number,
 * archive original text in the private ops ledger only.
 * Caller must persist the returned wall (avoids storage ↔ ops import cycles).
 */
export function emergencyRemoveMessage(input: {
  wall: WallState
  messageId: string
  reason: string
  operatorNote?: string
  adminKey: string
}): { wall: WallState; removal: AdminRemoval } {
  if (!verifyAdminKey(input.adminKey)) {
    throw new Error('Invalid admin key.')
  }

  const target = input.wall.messages.find((m) => m.id === input.messageId)
  if (!target) throw new Error('Message not found.')
  if (target.text === REMOVED_PLACEHOLDER) {
    throw new Error('Message already removed.')
  }

  const removal: AdminRemoval = {
    id: `rm_${Date.now().toString(36)}`,
    messageId: target.id,
    messageNumber: target.number,
    previousText: target.text,
    reason: input.reason.trim().slice(0, 200) || 'Policy violation',
    removedAt: Date.now(),
    operatorNote: (input.operatorNote ?? '').trim().slice(0, 400),
  }

  const messages = input.wall.messages.map((m) =>
    m.id === target.id
      ? {
          id: m.id,
          text: REMOVED_PLACEHOLDER,
          createdAt: m.createdAt,
          reactions: m.reactions,
          number: m.number,
        }
      : m,
  )

  const nextWall: WallState = { ...input.wall, messages }

  const ops = loadModerationOps()
  const reports = ops.reports.map((r) =>
    r.messageId === target.id ? { ...r, status: 'resolved' as const } : r,
  )
  saveOps({ reports, removals: [removal, ...ops.removals] })

  return { wall: nextWall, removal }
}
