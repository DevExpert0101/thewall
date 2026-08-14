import type { EventSnapshot, PublicMessage } from "@/lib/types";
import { remainClause, remainingLabel, untilOpenClause } from "@/lib/event/remaining";
import { APP_NAME, TAGLINE } from "@/lib/constants";
import { formatCount, formatPublicNumber } from "@/lib/utils";

export const CREATIVE_SIZES = {
  "1200x630": { width: 1200, height: 630 },
  "1:1": { width: 1080, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
} as const;

export type CreativeRatio = keyof typeof CREATIVE_SIZES;
export type CreativeKind = "countdown" | "milestone" | "message" | "certificate";

export type CreativeCopy = {
  kind: CreativeKind;
  kicker: string;
  title: string;
  body: string;
  foot: string;
  number?: string;
};

const RATIO_ALIASES: Record<string, CreativeRatio> = {
  "1200x630": "1200x630",
  og: "1200x630",
  landscape: "1200x630",
  "16:9": "1200x630",
  "1:1": "1:1",
  square: "1:1",
  "9:16": "9:16",
  portrait: "9:16",
};

export function resolveCreativeRatio(raw: string | null | undefined): CreativeRatio | null {
  if (!raw) return "1200x630";
  return RATIO_ALIASES[raw] ?? null;
}

export function composeCreative(input: {
  kind: CreativeKind;
  event: EventSnapshot;
  message?: PublicMessage;
}): CreativeCopy {
  const { kind, event, message } = input;

  if (kind === "message" || kind === "certificate") {
    if (!message) {
      throw new Error("Message required");
    }
    const number = formatPublicNumber(message.publicNumber);
    const quote = message.isRemoved ? message.text : `“${message.text}”`;
    const fires = `${formatCount(message.reactionCount)} 🔥`;
    if (kind === "certificate") {
      const rank = message.finalRank ? `Final rank #${message.finalRank}` : "Rank pending finalization";
      return {
        kind,
        kicker: "CERTIFICATE",
        title: `MESSAGE ${number}`,
        body: quote,
        foot: `${rank}  ·  ${fires}  ·  ${TAGLINE}`,
        number,
      };
    }
    const clock =
      event.phase === "live" ? remainClause(event.endsAt, event.serverNow) : "The Wall is frozen";
    return {
      kind,
      kicker: APP_NAME,
      title: number,
      body: quote,
      foot: `${fires}   ${clock}`,
      number,
    };
  }

  if (kind === "milestone") {
    const count = event.totalMessages;
    const title =
      count === 0
        ? "THE STONE IS STILL BLANK."
        : count === 1
          ? "1 PERSON HAS LEFT A SENTENCE."
          : `${formatCount(count)} PEOPLE HAVE LEFT A SENTENCE.`;
    const body =
      event.phase === "upcoming"
        ? untilOpenClause(event.startsAt, event.serverNow) + "."
        : event.phase === "live"
          ? `${remainClause(event.endsAt, event.serverNow)}. Anyone can still write.`
          : "The Wall is frozen. It does not reopen.";
    return {
      kind,
      kicker: APP_NAME,
      title,
      body,
      foot: TAGLINE,
    };
  }

  const clock = remainingLabel(
    event.phase === "upcoming" ? event.startsAt : event.endsAt,
    event.serverNow,
  );
  if (event.phase === "upcoming") {
    return {
      kind: "countdown",
      kicker: APP_NAME,
      title: untilOpenClause(event.startsAt, event.serverNow).toUpperCase(),
      body: "WHAT WILL YOU LEAVE BEHIND?",
      foot: clock,
    };
  }
  if (event.phase === "live") {
    return {
      kind: "countdown",
      kicker: APP_NAME,
      title: clock.replace(" REMAINING", "") + " LEFT",
      body: "WHAT WILL YOU LEAVE BEHIND?",
      foot: `${formatCount(event.totalMessages)} sentences  ·  ${formatCount(event.totalReactions)} 🔥`,
    };
  }
  return {
    kind: "countdown",
    kicker: APP_NAME,
    title: "THE WALL IS FROZEN",
    body: `${formatCount(event.totalMessages)} sentences remain on the stone.`,
    foot: TAGLINE,
  };
}
