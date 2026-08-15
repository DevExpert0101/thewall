import type {
  AllTimeRecords,
  EditionHighlight,
  EditionRecords,
  EditionSummary,
  EventSnapshot,
  PublicMessage,
} from "@/lib/types";
import { editionNumberOf } from "@/lib/utils";

export function highlightFrom(message: PublicMessage | null | undefined): EditionHighlight | null {
  if (!message) return null;
  return {
    publicNumber: message.publicNumber,
    text: message.text,
    isRemoved: message.isRemoved,
    reactionCount: message.reactionCount,
    finalRank: message.finalRank,
    publishedAt: message.publishedAt,
  };
}

export function durationHoursOf(startsAt: string, endsAt: string): number {
  const ms = Date.parse(endsAt) - Date.parse(startsAt);
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms / (60 * 60 * 1000));
}

export function peakMessagesPerMinute(messages: PublicMessage[]): number {
  if (messages.length === 0) return 0;
  const buckets = new Map<string, number>();
  for (const message of messages) {
    const key = message.publishedAt.slice(0, 16);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Math.max(...buckets.values());
}

export function recordsFromMessages(
  editionNumber: number,
  event: Pick<EventSnapshot, "startsAt" | "endsAt" | "totalMessages" | "totalReactions">,
  messages: PublicMessage[],
): EditionRecords {
  const ordered = [...messages].sort((a, b) => a.publicNumber - b.publicNumber);
  const byRank = [...messages].filter((message) => message.finalRank != null).sort((a, b) => {
    return (a.finalRank ?? 0) - (b.finalRank ?? 0);
  });
  const byFire = [...messages].sort(
    (a, b) =>
      b.reactionCount - a.reactionCount ||
      a.publishedAt.localeCompare(b.publishedAt) ||
      a.publicNumber - b.publicNumber,
  );
  const first = ordered[0] ?? null;
  const last = ordered.at(-1) ?? null;
  const winning = byRank[0] ?? byFire[0] ?? null;
  return {
    editionNumber,
    first: highlightFrom(first),
    last: highlightFrom(last),
    winning: highlightFrom(winning),
    mostReacted: highlightFrom(byFire[0] ?? null),
    milestone100000: highlightFrom(ordered.find((message) => message.publicNumber === 100_000) ?? null),
    milestone250000: highlightFrom(ordered.find((message) => message.publicNumber === 250_000) ?? null),
    totalMessages: event.totalMessages,
    totalReactions: event.totalReactions,
    durationHours: durationHoursOf(event.startsAt, event.endsAt),
    peakMessagesPerMinute: peakMessagesPerMinute(messages),
  };
}

export function allTimeFromEditions(
  editions: EditionSummary[],
  extras: { mostFireOnMessage?: AllTimeRecords["mostFireOnMessage"]; peaks?: Map<number, number> } = {},
): AllTimeRecords {
  if (editions.length === 0) {
    return {
      mostMessages: null,
      mostReactions: null,
      mostFireOnMessage: extras.mostFireOnMessage ?? null,
      largestFinalMinute: null,
    };
  }
  const mostMessages = [...editions].sort((a, b) => b.totalMessages - a.totalMessages)[0]!;
  const mostReactions = [...editions].sort((a, b) => b.totalReactions - a.totalReactions)[0]!;
  let mostFire = extras.mostFireOnMessage ?? null;
  if (!mostFire) {
    for (const edition of editions) {
      if (!edition.winning) continue;
      if (!mostFire || edition.winning.reactionCount > mostFire.reactionCount) {
        mostFire = {
          editionNumber: edition.editionNumber,
          publicNumber: edition.winning.publicNumber,
          reactionCount: edition.winning.reactionCount,
        };
      }
    }
  }
  let largestFinalMinute: AllTimeRecords["largestFinalMinute"] = null;
  for (const edition of editions) {
    const peak = extras.peaks?.get(edition.editionNumber) ?? 0;
    if (peak > 0 && (!largestFinalMinute || peak > largestFinalMinute.peakMessagesPerMinute)) {
      largestFinalMinute = { editionNumber: edition.editionNumber, peakMessagesPerMinute: peak };
    }
  }
  return {
    mostMessages: {
      editionNumber: mostMessages.editionNumber,
      totalMessages: mostMessages.totalMessages,
    },
    mostReactions: {
      editionNumber: mostReactions.editionNumber,
      totalReactions: mostReactions.totalReactions,
    },
    mostFireOnMessage: mostFire,
    largestFinalMinute,
  };
}

export function editionNumberFromEvent(event: EventSnapshot): number {
  return editionNumberOf(event);
}
