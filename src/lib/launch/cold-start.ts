import { formatEventInstant } from "@/lib/event/remaining";
import { MESSAGE_MARKS } from "@/lib/milestones/engine";
import type { EventSnapshot } from "@/lib/types";
import { formatCount } from "@/lib/utils";

/** First-hundred scarcity. Only used while the real count is below this. */
export const FIRST_VOICES = 100;

export const WAITING_PATH = "/open";
export const INVITE_PATH = "/invite";
export const STREAM_PATH = "/live";

export const JUST_OPENED_TITLE = "THE WALL HAS JUST OPENED.";
export const FIRST_HUNDRED_LINE = "YOU COULD BE ONE OF THE FIRST 100 VOICES.";
export const WAITING_ROOM_TITLE = "THE WAITING ROOM IS OPEN.";

export type LaunchMoment = "waiting" | "just_opened" | "open" | "closed";

export type LaunchCopy = {
  moment: LaunchMoment;
  kicker: string;
  title: string;
  body: string;
};

type LaunchEvent = Pick<EventSnapshot, "phase" | "startsAt" | "totalMessages">;

export function launchMoment(event: Pick<EventSnapshot, "phase" | "totalMessages">): LaunchMoment {
  if (event.phase === "upcoming") return "waiting";
  if (event.phase !== "live") return "closed";
  if (event.totalMessages < FIRST_VOICES) return "just_opened";
  return "open";
}

export function firstHundredRemaining(totalMessages: number): number {
  return Math.max(0, FIRST_VOICES - Math.max(0, totalMessages));
}

export function nextUnreachedMessageMark(totalMessages: number): number | null {
  return MESSAGE_MARKS.find((mark) => totalMessages < mark) ?? null;
}

export function nextMarkLine(totalMessages: number): string | null {
  const next = nextUnreachedMessageMark(totalMessages);
  if (next == null) return null;
  if (next === 1) return "The first sentence has not been written.";
  const remain = next - totalMessages;
  return `Next recorded mark: ${formatCount(next)} voices. ${formatCount(remain)} to go. Not reached yet.`;
}

export function firstHundredLine(totalMessages: number): string {
  if (totalMessages <= 0) return FIRST_HUNDRED_LINE;
  const remain = firstHundredRemaining(totalMessages);
  if (remain <= 0) return `${formatCount(totalMessages)} voices are on this Wall.`;
  const voices = totalMessages === 1 ? "1 voice" : `${formatCount(totalMessages)} voices`;
  const seats = remain === 1 ? "1 seat remains" : `${formatCount(remain)} seats remain`;
  return `${voices} so far. ${seats} in the first hundred.`;
}

export function launchCopy(event: LaunchEvent, invited = false): LaunchCopy {
  const moment = launchMoment(event);
  if (moment === "waiting") {
    return {
      moment,
      kicker: `Opens ${formatEventInstant(event.startsAt)}`,
      title: WAITING_ROOM_TITLE,
      body: invited
        ? "You were invited to be here when it opens. The stone is still blank. No sentences have been carved."
        : "The stone is still blank. No sentences have been carved. The countdown is the show.",
    };
  }
  if (moment === "just_opened") {
    return {
      moment,
      kicker: "Happening now",
      title: JUST_OPENED_TITLE,
      body: firstHundredLine(event.totalMessages),
    };
  }
  if (moment === "open") {
    return {
      moment,
      kicker: "Happening now",
      title: "THE WALL IS OPEN.",
      body: `${formatCount(event.totalMessages)} voices. Anyone can read. One dollar writes.`,
    };
  }
  return {
    moment,
    kicker: "Closed",
    title: "THE WALL IS CLOSED.",
    body: "Writing has stopped. The stone does not reopen.",
  };
}

export function creatorLaunchLinks() {
  return [
    { href: WAITING_PATH, label: "Waiting room", note: "Shareable opening page. No special rights." },
    { href: INVITE_PATH, label: "Invite", note: "Same room, with an invitation line." },
    { href: STREAM_PATH, label: "Stream mode", note: "OBS board: #1, Rising, random, countdown. No wallets." },
  ] as const;
}
