import { APP_NAME } from "@/lib/constants";
import { closesInClause, remainClause, untilOpenClause } from "@/lib/event/remaining";
import { FIRST_HUNDRED_LINE, JUST_OPENED_TITLE, firstHundredLine, launchMoment } from "@/lib/launch/cold-start";
import {
  milestoneChorus,
  milestoneHeadline,
  type Milestone,
} from "@/lib/milestones/engine";
import type { EventSnapshot, PublicMessage } from "@/lib/types";
import {
  editionMessagePath,
  editionNumberOf,
  formatCount,
  formatObjectIdentity,
  formatShareIdentity,
  formatWallPlace,
  siteUrl,
} from "@/lib/utils";

export function quotedSentence(text: string | undefined, removed = false): string | null {
  if (!text || removed) return null;
  return `“${text}”`;
}

export type SharePayload = {
  title: string;
  text: string;
  path: string;
  url: string;
};

export function messagePath(publicNumber: number): string {
  return `/message/${publicNumber}`;
}

function joinUrl(path: string): string {
  const origin = siteUrl();
  if (path === "/") return origin;
  return `${origin}${path}`;
}

export function sharePayloadForMessage(input: {
  event: Pick<EventSnapshot, "phase" | "endsAt" | "serverNow" | "editionNumber">;
  message: Pick<PublicMessage, "publicNumber" | "isRemoved" | "finalRank" | "text" | "reactionCount">;
  now?: string;
  path?: string;
}): SharePayload {
  const now = input.now ?? input.event.serverNow;
  const edition = editionNumberOf(input.event);
  const catalog = formatObjectIdentity(input.message.publicNumber, edition);
  const spoken = formatShareIdentity(input.message.publicNumber, edition);
  const place = formatWallPlace(edition);
  const quote = quotedSentence(input.message.text, input.message.isRemoved);
  const path =
    input.path ??
    (input.event.phase === "archived"
      ? editionMessagePath(edition, input.message.publicNumber)
      : messagePath(input.message.publicNumber));
  const url = joinUrl(path);
  const title = quote ?? catalog;

  if (input.message.isRemoved) {
    return {
      title: catalog,
      text: `${spoken} was removed under archive policy.`,
      path,
      url,
    };
  }

  if (input.event.phase === "live") {
    return {
      title,
      text: [quote, spoken + ".", `${closesInClause(input.event.endsAt, now)}.`].filter(Boolean).join("\n"),
      path,
      url,
    };
  }

  const lines = [quote, spoken + ".", input.message.finalRank ? `Final rank #${input.message.finalRank}.` : null, `${place} is sealed.`].filter(
    (line): line is string => Boolean(line),
  );
  return { title, text: lines.join("\n"), path, url };
}

export function sharePayloadForEvent(
  event: Pick<EventSnapshot, "phase" | "startsAt" | "endsAt" | "serverNow" | "totalMessages">,
  path = "/",
  now?: string,
): SharePayload {
  const clock = now ?? event.serverNow;
  const url = joinUrl(path);
  const count = formatCount(event.totalMessages);

  if (event.phase === "upcoming") {
    return {
      title: `${APP_NAME} — ${untilOpenClause(event.startsAt, clock)}`,
      text: [`${untilOpenClause(event.startsAt, clock)}.`, "The stone is still blank."].join("\n"),
      path,
      url,
    };
  }

  if (event.phase === "live") {
    const remain = remainClause(event.endsAt, clock);
    const moment = launchMoment(event);
    const sentences =
      event.totalMessages === 0
        ? "No one has spoken yet — the stone is still blank."
        : event.totalMessages === 1
          ? "1 person spoke."
          : `${count} people spoke.`;
    const lines = [`The Wall is live.`, `${remain}.`, sentences];
    if (moment === "just_opened") {
      lines.push(JUST_OPENED_TITLE, event.totalMessages === 0 ? FIRST_HUNDRED_LINE : firstHundredLine(event.totalMessages));
    }
    return {
      title: `${APP_NAME} — ${remain}`,
      text: lines.join("\n"),
      path,
      url,
    };
  }

  const closed =
    event.totalMessages === 0
      ? "The Wall closed on a blank stone."
      : `${count} people spoke. The Wall does not reopen.`;
  return {
    title: `${APP_NAME} — sealed`,
    text: ["The Wall is sealed.", closed].join("\n"),
    path,
    url,
  };
}

export function sharePayloadForMilestone(input: {
  event: Pick<EventSnapshot, "phase" | "endsAt" | "serverNow" | "editionNumber">;
  milestone: Milestone;
  now?: string;
}): SharePayload {
  const path = input.milestone.kind === "message" ? messagePath(input.milestone.value) : "/wall";
  const clock =
    input.event.phase === "live"
      ? `${closesInClause(input.event.endsAt, input.now ?? input.event.serverNow)}.`
      : `${formatWallPlace(editionNumberOf(input.event))} is frozen.`;
  return {
    title: milestoneHeadline(input.milestone),
    text: [milestoneHeadline(input.milestone), milestoneChorus(input.milestone), clock].join("\n"),
    path,
    url: joinUrl(path),
  };
}

export function ogCopyForEvent(
  event: Pick<EventSnapshot, "phase" | "startsAt" | "endsAt" | "serverNow" | "totalMessages">,
  now?: string,
): { title: string; description: string } {
  const payload = sharePayloadForEvent(event, "/", now);
  return {
    title: payload.title,
    description: payload.text.replace(/\n/g, " "),
  };
}

export function ogCopyForMessage(input: {
  event: Pick<EventSnapshot, "phase" | "endsAt" | "serverNow" | "editionNumber">;
  message: Pick<PublicMessage, "publicNumber" | "text" | "isRemoved" | "reactionCount">;
  now?: string;
}): { title: string; description: string } {
  const title = formatObjectIdentity(input.message.publicNumber, editionNumberOf(input.event));
  if (input.message.isRemoved) {
    return { title, description: "Message removed under archive policy." };
  }
  const quote = `“${input.message.text}”`;
  if (input.event.phase === "live") {
    return {
      title,
      description: `${quote} ${closesInClause(input.event.endsAt, input.now ?? input.event.serverNow)}.`,
    };
  }
  return { title, description: quote };
}

export function sharePayloadForWinner(input: {
  editionNumber: number;
  publicNumber: number;
  text: string;
  reactionCount: number;
  isRemoved?: boolean;
}): SharePayload {
  const quote = quotedSentence(input.text, input.isRemoved);
  const path = editionMessagePath(input.editionNumber, input.publicNumber);
  return {
    title: quote ?? formatObjectIdentity(input.publicNumber, input.editionNumber),
    text: [
      quote,
      `${formatShareIdentity(input.publicNumber, input.editionNumber)} won.`,
      `${formatCount(input.reactionCount)} 🔥.`,
    ]
      .filter(Boolean)
      .join("\n"),
    path,
    url: joinUrl(path),
  };
}
