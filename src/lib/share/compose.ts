import type { EventSnapshot, PublicMessage } from "@/lib/types";
import { remainClause, remainingLabel, untilOpenClause } from "@/lib/event/remaining";
import { FIRST_HUNDRED_LINE, FIRST_VOICES, JUST_OPENED_TITLE, firstHundredLine } from "@/lib/launch/cold-start";
import { APP_NAME } from "@/lib/constants";
import {
  hasReachedMilestone,
  milestoneChorus,
  milestoneHeadline,
  type Milestone,
} from "@/lib/milestones/engine";
import {
  editionNumberOf,
  formatCount,
  formatEditionNumber,
  formatMessageMark,
  formatPublicNumber,
  formatWallEdition,
  formatWallShort,
} from "@/lib/utils";

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
  brand?: string;
  edition?: string;
  status?: string;
  clock?: string;
  reactions?: string;
  invite?: string;
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

export function cardStatusLine(phase: EventSnapshot["phase"]): string {
  if (phase === "live") return "LIVE";
  if (phase === "finalizing") return "CLOSED";
  if (phase === "archived") return "SEALED";
  return "NOT YET OPEN";
}

/** Live clock or sealed/closed mark. Never invents remaining time after close. */
export function cardClockLine(
  event: Pick<EventSnapshot, "phase" | "endsAt" | "serverNow" | "editionNumber">,
): string {
  const short = formatWallShort(editionNumberOf(event));
  if (event.phase === "live") {
    return remainingLabel(event.endsAt, event.serverNow);
  }
  if (event.phase === "archived") {
    return `SEALED — ${short}`;
  }
  return `CLOSED — ${short}`;
}

export function composeCreative(input: {
  kind: CreativeKind;
  event: EventSnapshot;
  message?: PublicMessage;
  milestone?: Milestone;
}): CreativeCopy {
  const { kind, event, message, milestone } = input;

  if (kind === "message" || kind === "certificate") {
    if (!message) {
      throw new Error("Message required");
    }
    const edition = editionNumberOf(event);
    const number = formatPublicNumber(message.publicNumber);
    const mark = formatMessageMark(message.publicNumber);
    const wall = formatWallEdition(edition);
    const quote = message.isRemoved ? message.text : `“${message.text}”`;
    const fires = `${formatCount(message.reactionCount)} 🔥`;
    if (kind === "certificate") {
      const rank = message.finalRank ? `Final rank #${message.finalRank}` : "Rank pending finalization";
      return {
        kind,
        kicker: wall,
        title: mark,
        body: quote,
        foot: `${rank}  ·  ${fires}`,
        number,
      };
    }
    const status = cardStatusLine(event.phase);
    const clock = cardClockLine(event);
    return {
      kind,
      brand: APP_NAME,
      edition: formatEditionNumber(edition),
      kicker: wall,
      title: mark,
      body: quote,
      status,
      clock,
      reactions: fires,
      foot: `${fires}  ·  ${status}  ·  ${clock}`,
      number,
    };
  }

  if (kind === "milestone") {
    if (milestone) {
      const reached = hasReachedMilestone(
        { messages: event.totalMessages, reactions: event.totalReactions },
        milestone,
      );
      if (!reached) {
        throw new Error("Milestone not reached");
      }
      const edition = editionNumberOf(event);
      return {
        kind,
        brand: APP_NAME,
        edition: formatEditionNumber(edition),
        kicker: formatWallEdition(edition),
        title: milestoneHeadline(milestone),
        body: milestoneChorus(milestone),
        status: cardStatusLine(event.phase),
        clock: cardClockLine(event),
        foot: `${cardStatusLine(event.phase)}  ·  ${cardClockLine(event)}`,
        number: milestone.kind === "message" ? formatPublicNumber(milestone.value) : undefined,
      };
    }
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
          ? `${remainClause(event.endsAt, event.serverNow)}.`
          : "The Wall is sealed. It does not reopen.";
    return {
      kind,
      kicker: APP_NAME,
      title,
      body,
      foot: cardClockLine(event),
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
      body: "The stone is still blank.",
      foot: clock,
    };
  }
  if (event.phase === "live") {
    if (event.totalMessages === 0) {
      return {
        kind: "countdown",
        kicker: APP_NAME,
        title: JUST_OPENED_TITLE,
        body: FIRST_HUNDRED_LINE,
        foot: clock,
      };
    }
    return {
      kind: "countdown",
      kicker: APP_NAME,
      title: clock.replace(" REMAINING", "") + " LEFT",
      body:
        event.totalMessages < FIRST_VOICES
          ? firstHundredLine(event.totalMessages).toUpperCase()
          : `${formatCount(event.totalMessages)} people spoke.`,
      foot: `${formatCount(event.totalMessages)} people  ·  ${formatCount(event.totalReactions)} 🔥`,
    };
  }
  return {
    kind: "countdown",
    kicker: APP_NAME,
    title: "THE WALL IS SEALED",
    body: `${formatCount(event.totalMessages)} people spoke.`,
    foot: `${formatCount(event.totalMessages)} people  ·  ${formatCount(event.totalReactions)} 🔥`,
  };
}
