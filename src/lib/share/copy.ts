import { APP_NAME, TAGLINE } from "@/lib/constants";
import { remainClause, untilOpenClause } from "@/lib/event/remaining";
import type { EventSnapshot, PublicMessage } from "@/lib/types";
import { formatCount, formatPublicNumber, siteUrl } from "@/lib/utils";

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
  event: Pick<EventSnapshot, "phase" | "endsAt" | "serverNow">;
  message: Pick<PublicMessage, "publicNumber" | "isRemoved" | "finalRank">;
  now?: string;
}): SharePayload {
  const now = input.now ?? input.event.serverNow;
  const number = formatPublicNumber(input.message.publicNumber);
  const path = messagePath(input.message.publicNumber);
  const url = joinUrl(path);
  const title = `${number} — ${APP_NAME}`;

  if (input.message.isRemoved) {
    return {
      title,
      text: `Message ${number} on The Wall was removed under archive policy.`,
      path,
      url,
    };
  }

  if (input.event.phase === "live") {
    return {
      title,
      text: [
        `I'm Message ${number} on The Wall.`,
        `${remainClause(input.event.endsAt, now)}.`,
        "Find me before the internet loses its chance to speak.",
      ].join("\n"),
      path,
      url,
    };
  }

  const lines = [`I'm Message ${number} on The Wall.`, "The Wall is frozen. This sentence stays."];
  if (input.message.finalRank) {
    lines.splice(1, 0, `Final rank #${input.message.finalRank}.`);
  }
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
      text: [
        `${untilOpenClause(event.startsAt, clock)}.`,
        "One anonymous wall. One dollar. One sentence.",
        TAGLINE,
      ].join("\n"),
      path,
      url,
    };
  }

  if (event.phase === "live") {
    const remain = remainClause(event.endsAt, clock);
    const sentences =
      event.totalMessages === 0
        ? "No sentences yet — the stone is still blank."
        : event.totalMessages === 1
          ? "1 sentence is already on the stone."
          : `${count} sentences are already on the stone.`;
    return {
      title: `${APP_NAME} — ${remain}`,
      text: [`The Wall is live.`, `${remain}.`, sentences, "Anyone can read. One USDC writes."].join("\n"),
      path,
      url,
    };
  }

  const closed =
    event.totalMessages === 0
      ? "The Wall closed on a blank stone."
      : `${count} sentences remain. The Wall does not reopen.`;
  return {
    title: `${APP_NAME} — frozen`,
    text: ["The Wall is frozen.", closed, TAGLINE].join("\n"),
    path,
    url,
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
  event: Pick<EventSnapshot, "phase" | "endsAt" | "serverNow">;
  message: Pick<PublicMessage, "publicNumber" | "text" | "isRemoved" | "reactionCount">;
  now?: string;
}): { title: string; description: string } {
  const number = formatPublicNumber(input.message.publicNumber);
  const title = `${number} — ${APP_NAME}`;
  if (input.message.isRemoved) {
    return { title, description: "Message removed under archive policy." };
  }
  const quote = `“${input.message.text}”`;
  if (input.event.phase === "live") {
    return {
      title,
      description: `${quote} ${remainClause(input.event.endsAt, input.now ?? input.event.serverNow)}. Find it before The Wall closes.`,
    };
  }
  return { title, description: quote };
}
