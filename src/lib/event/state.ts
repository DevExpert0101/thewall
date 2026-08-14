import { AppError, ERROR_CODES } from "@/lib/errors";

export type EventPhase = "upcoming" | "live" | "finalizing" | "archived";

export type EventTimestamps = {
  startsAt: string;
  endsAt: string;
  archivedAt: string | null;
  finalizedAt: string | null;
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

export function countdownLabel(phase: EventPhase): string {
  if (phase === "upcoming") return "Until launch";
  if (phase === "live") return "Remaining";
  return "Closed";
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
    throw new AppError(ERROR_CODES.EVENT_ENDED, "The Wall is closed.", 403);
  }
}

export function remainingMs(endsAt: string, now: Date = new Date()): number {
  return Math.max(0, new Date(endsAt).getTime() - now.getTime());
}

export function msUntilStart(startsAt: string, now: Date = new Date()): number {
  return Math.max(0, new Date(startsAt).getTime() - now.getTime());
}
