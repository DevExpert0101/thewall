import { BRAND } from "@/lib/brand";
import type { EventPhase } from "@/lib/event/state";

export const FINAL_HOUR_MS = 60 * 60 * 1000;
export const FINAL_TEN_MS = 10 * 60 * 1000;
export const FINAL_MINUTE_MS = 60 * 1000;
export const FINAL_TEN_SECONDS_MS = 10 * 1000;

export type EventPresentation =
  | "upcoming"
  | "live"
  | "final-hour"
  | "final-ten"
  | "final-minute"
  | "final-seconds"
  | "closed";

export const CLOSED_LOCK_LINE = "NO ONE CAN ADD ANOTHER WORD.";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Live urgency from remaining milliseconds. Closed at or below zero. */
export function liveUrgency(
  remainingMs: number,
): "normal" | "hour" | "ten" | "minute" | "ten-seconds" | "closed" {
  if (remainingMs <= 0) return "closed";
  if (remainingMs <= FINAL_TEN_SECONDS_MS) return "ten-seconds";
  if (remainingMs <= FINAL_MINUTE_MS) return "minute";
  if (remainingMs <= FINAL_TEN_MS) return "ten";
  if (remainingMs <= FINAL_HOUR_MS) return "hour";
  return "normal";
}

/**
 * Visitor-facing event atmosphere. Phase stays authoritative;
 * remaining time only refines a live window.
 */
export function eventPresentation(phase: EventPhase, remainingMs: number): EventPresentation {
  if (phase === "upcoming") return "upcoming";
  if (phase !== "live") return "closed";
  const urgency = liveUrgency(remainingMs);
  if (urgency === "closed") return "closed";
  if (urgency === "ten-seconds") return "final-seconds";
  if (urgency === "minute") return "final-minute";
  if (urgency === "ten") return "final-ten";
  if (urgency === "hour") return "final-hour";
  return "live";
}

export function closedEditionHeadline(editionNumber = 1): string {
  const n = Number.isInteger(editionNumber) && editionNumber > 0 ? editionNumber : 1;
  return `THE WALL №${String(n).padStart(3, "0")} HAS CLOSED.`;
}

/** Public census after the clock hits zero. Not a rank and not a winner. */
export function closedCensusLine(totalMessages: number): string {
  const n = Number.isFinite(totalMessages) ? Math.max(0, Math.floor(totalMessages)) : 0;
  return `${new Intl.NumberFormat("en-US").format(n)} PEOPLE SPOKE.`;
}

/** Whole seconds left, held for a full second. Used on the T-60 / T-10 faces. */
export function remainingWholeSeconds(remainingMs: number): number {
  return Math.max(0, Math.ceil(Math.max(0, remainingMs) / 1000));
}

export function remainingNotice(presentation: EventPresentation, remainingMs: number): string | null {
  if (presentation === "final-hour") {
    const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
    return minutes === 1 ? "1 MINUTE REMAINS." : `${minutes} MINUTES REMAIN.`;
  }
  if (presentation === "final-ten") {
    const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
    return minutes === 1 ? "1 MINUTE REMAINS." : `${minutes} MINUTES REMAIN.`;
  }
  if (presentation === "final-minute" || presentation === "final-seconds") {
    const seconds = Math.max(1, remainingWholeSeconds(remainingMs));
    return seconds === 1 ? "1 SECOND REMAINS." : `${seconds} SECONDS REMAIN.`;
  }
  return null;
}

export function publishUrgencyLine(presentation: EventPresentation): string | null {
  if (presentation === "final-hour") return "The last hour is open.";
  if (presentation === "final-ten") return "The last minutes are open.";
  if (presentation === "final-minute" || presentation === "final-seconds") {
    return "The Wall closes now.";
  }
  return null;
}

export function formatEventInstant(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
    .format(d)
    .toUpperCase();
  return `${date} · ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

/** Coarse live-region key. Must not change every second. */
export function countdownLiveBucket(remainingMs: number, frozen = false): string {
  if (frozen || remainingMs <= 0) return "closed";
  if (remainingMs <= FINAL_MINUTE_MS) return "final-minute";
  if (remainingMs <= 5 * 60_000) return "final-five";
  if (remainingMs <= FINAL_TEN_MS) return "final-ten";
  if (remainingMs <= 30 * 60_000) return "final-thirty";
  if (remainingMs <= FINAL_HOUR_MS) return "final-hour";
  return `hours:${Math.floor(remainingMs / 3_600_000)}`;
}

export function countdownLiveText(label: string, bucket: string): string {
  if (bucket === "closed") return `${label}: ${BRAND.closed}`;
  if (bucket === "final-minute") return `${label}: less than one minute remaining`;
  if (bucket === "final-five") return `${label}: 5 minutes remaining`;
  if (bucket === "final-ten") return `${label}: 10 minutes remaining`;
  if (bucket === "final-thirty") return `${label}: 30 minutes remaining`;
  if (bucket === "final-hour") return `${label}: 1 hour remaining`;
  const hours = Number(bucket.slice("hours:".length));
  if (hours === 1) return `${label}: 1 hour remaining`;
  return `${label}: ${hours} hours remaining`;
}

/** Accessible name when the clock is focused. Minutes, never ticking seconds. */
export function countdownSpokenName(label: string, remainingMs: number, frozen = false): string {
  if (frozen || remainingMs <= 0) return `${label}: closed`;
  if (remainingMs <= FINAL_MINUTE_MS) return `${label}: less than one minute remaining`;
  const hours = Math.floor(remainingMs / 3_600_000);
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000);
  if (hours === 0) {
    return minutes === 1 ? `${label}: 1 minute remaining` : `${label}: ${minutes} minutes remaining`;
  }
  if (minutes === 0) {
    return hours === 1 ? `${label}: 1 hour remaining` : `${label}: ${hours} hours remaining`;
  }
  const hourPart = hours === 1 ? "1 hour" : `${hours} hours`;
  const minutePart = minutes === 1 ? "1 minute" : `${minutes} minutes`;
  return `${label}: ${hourPart}, ${minutePart} remaining`;
}

export function remainingMsFrom(endsAt: string, now: Date | string | number): number {
  const nowMs = typeof now === "number" ? now : new Date(now).getTime();
  return Math.max(0, new Date(endsAt).getTime() - nowMs);
}

export function formatRemainingClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function remainingLabel(endsAt: string, now: Date | string | number = new Date()): string {
  return `${formatRemainingClock(remainingMsFrom(endsAt, now))} REMAINING`;
}

/** Honest remaining language for share copy. Floors whole units — never rounds up. */
export function remainClause(endsAt: string, now: Date | string | number = new Date()): string {
  const ms = remainingMsFrom(endsAt, now);
  if (ms <= 0) return BRAND.closed;
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor(ms / 60_000);
  if (hours >= 2) return `${hours} hours remain`;
  if (hours === 1) return "1 hour remains";
  if (minutes >= 2) return `${minutes} minutes remain`;
  if (minutes === 1) return "1 minute remains";
  return "Moments remain";
}

/** Share-card remaining line. Same floor as remainClause — never rounds up. */
export function closesInClause(endsAt: string, now: Date | string | number = new Date()): string {
  const ms = remainingMsFrom(endsAt, now);
  if (ms <= 0) return BRAND.closed;
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor(ms / 60_000);
  if (hours >= 2) return `The Wall closes in ${hours} hours`;
  if (hours === 1) return "The Wall closes in 1 hour";
  if (minutes >= 2) return `The Wall closes in ${minutes} minutes`;
  if (minutes === 1) return "The Wall closes in 1 minute";
  return "The Wall closes in moments";
}

export function untilOpenClause(startsAt: string, now: Date | string | number = new Date()): string {
  const ms = remainingMsFrom(startsAt, now);
  if (ms <= 0) return "The Wall is open";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor(ms / 60_000);
  if (hours >= 2) return `The Wall opens in ${hours} hours`;
  if (hours === 1) return "The Wall opens in 1 hour";
  if (minutes >= 2) return `The Wall opens in ${minutes} minutes`;
  if (minutes === 1) return "The Wall opens in 1 minute";
  return "The Wall opens in moments";
}
