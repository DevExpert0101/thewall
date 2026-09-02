import { AppError, ERROR_CODES } from "@/lib/errors";
import {
  defaultEventOps,
  isPublishEnabled,
  isReactEnabled,
  type EventOpsControls,
} from "@/lib/ops/controls";
import type { PublicMessage } from "@/lib/types";

export type EventPhase = "upcoming" | "live" | "finalizing" | "archived";

export type EventTimestamps = {
  startsAt: string;
  endsAt: string;
  archivedAt: string | null;
  finalizedAt: string | null;
  /** Sticky close-for-review. Clock rollback cannot reopen writes. */
  reviewClosedAt?: string | null;
};

/**
 * Server/database time is authoritative. Pass `now` from the server, never from
 * a browser countdown, when deciding whether a write is allowed.
 */
export function deriveEventPhase(
  timestamps: EventTimestamps,
  now: Date = new Date(),
): EventPhase {
  const startsAt = new Date(timestamps.startsAt).getTime();
  const endsAt = new Date(timestamps.endsAt).getTime();
  const archivedAt = timestamps.archivedAt
    ? new Date(timestamps.archivedAt).getTime()
    : null;
  const finalizedAt = timestamps.finalizedAt
    ? new Date(timestamps.finalizedAt).getTime()
    : null;
  const t = now.getTime();

  if (archivedAt !== null && t >= archivedAt) return "archived";
  if (finalizedAt !== null && t >= endsAt) return "archived";
  if (timestamps.reviewClosedAt) return "finalizing";
  if (t < startsAt) return "upcoming";
  if (t < endsAt) return "live";
  return "finalizing";
}

export function isEventWritable(phase: EventPhase): boolean {
  return phase === "live";
}

export function isEventClosed(phase: EventPhase): boolean {
  return phase === "finalizing" || phase === "archived";
}

/** Public results exist only after stewardship finishes the review. */
export function isEventSealed(phase: EventPhase): boolean {
  return phase === "archived";
}

/** Final ranks stay private until the edition is disclosed. */
export function publicMessageForPhase(
  message: PublicMessage,
  phase: EventPhase,
): PublicMessage {
  if (isEventSealed(phase) || message.finalRank == null) return message;
  return { ...message, finalRank: null };
}

export function isPublishAllowed(phase: EventPhase): boolean {
  return isEventWritable(phase);
}

export function isReactionAllowed(phase: EventPhase): boolean {
  return isEventWritable(phase);
}

export function countdownTargetIso(
  phase: EventPhase,
  timestamps: EventTimestamps,
): string {
  return phase === "upcoming" ? timestamps.startsAt : timestamps.endsAt;
}

/** Visitor-facing phase words. Never show the internal slug. */
export function publicPhaseLabel(phase: EventPhase): string {
  if (phase === "upcoming") return "Not yet open";
  if (phase === "live") return "Live";
  if (phase === "finalizing") return "Closed for review";
  return "Sealed";
}

export function countdownLabel(phase: EventPhase): string {
  if (phase === "upcoming") return "Until launch";
  if (phase === "live") return "Remaining";
  return "Closed";
}

/** A later Wall is not a reopen of the one the visitor already saw close. */
export function isSuccessorWall(input: {
  startsAt?: string;
  previousStartsAt?: string;
  editionNumber?: number;
  previousEditionNumber?: number;
}): boolean {
  if (
    input.editionNumber != null &&
    input.previousEditionNumber != null &&
    input.editionNumber !== input.previousEditionNumber
  ) {
    return true;
  }
  return Boolean(
    input.startsAt &&
      input.previousStartsAt &&
      input.startsAt !== input.previousStartsAt,
  );
}

/**
 * Never reopen a closed wall from a stale "live" payload.
 * Clock expiry is enough to freeze the public surface.
 * A new startsAt / Wall number is a different day — accept it.
 */
export function reconcilePublicPhase(input: {
  reported: EventPhase;
  endsAt: string;
  now: Date | string | number;
  previous?: EventPhase;
  startsAt?: string;
  previousStartsAt?: string;
  editionNumber?: number;
  previousEditionNumber?: number;
}): EventPhase {
  const nowMs = typeof input.now === "number" ? input.now : new Date(input.now).getTime();
  const ended = new Date(input.endsAt).getTime() <= nowMs;
  if (isSuccessorWall(input)) {
    if (input.reported === "archived") return "archived";
    if (ended) return "finalizing";
    return input.reported;
  }
  if (input.reported === "archived" || input.previous === "archived") return "archived";
  if (ended) return "finalizing";
  if (input.previous === "finalizing" && input.reported === "live") {
    return input.previous;
  }
  return input.reported;
}

/** Phase plus ends_at. Delayed packets cannot publish after the server deadline. */
export function assertWritesOpen(
  event: { phase: EventPhase; endsAt: string; reviewClosedAt?: string | null },
  now: Date = new Date(),
): void {
  if (event.reviewClosedAt) {
    throw new AppError(ERROR_CODES.EVENT_ENDED, "The Wall has closed.", 403);
  }
  assertEventLive(event.phase);
  if (new Date(event.endsAt).getTime() <= now.getTime()) {
    throw new AppError(ERROR_CODES.EVENT_ENDED, "The Wall has closed.", 403);
  }
}

/** Publish path. Kill switch does not move starts_at or ends_at. */
export function assertPublishOpen(
  event: { phase: EventPhase; endsAt: string },
  ops: EventOpsControls = defaultEventOps(),
  now: Date = new Date(),
): void {
  assertWritesOpen(event, now);
  if (!isPublishEnabled(ops)) {
    throw new AppError(ERROR_CODES.EVENT_NOT_LIVE, "Publishing is paused.", 403);
  }
}

/** Reaction path. Independent of the publish kill switch. */
export function assertReactOpen(
  event: { phase: EventPhase; endsAt: string },
  ops: EventOpsControls = defaultEventOps(),
  now: Date = new Date(),
): void {
  assertWritesOpen(event, now);
  if (!isReactEnabled(ops)) {
    throw new AppError(ERROR_CODES.EVENT_NOT_LIVE, "Reactions are paused.", 403);
  }
}

export function assertEventLive(phase: EventPhase): void {
  if (phase === "upcoming") {
    throw new AppError(
      ERROR_CODES.EVENT_UPCOMING,
      "The Wall has not opened yet.",
      403,
    );
  }
  if (phase !== "live") {
    throw new AppError(ERROR_CODES.EVENT_ENDED, "The Wall has closed.", 403);
  }
}

export function remainingMs(endsAt: string, now: Date = new Date()): number {
  return Math.max(0, new Date(endsAt).getTime() - now.getTime());
}

export function msUntilStart(startsAt: string, now: Date = new Date()): number {
  return Math.max(0, new Date(startsAt).getTime() - now.getTime());
}
