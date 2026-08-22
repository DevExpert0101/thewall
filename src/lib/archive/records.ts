import type {
  AllTimeRecords,
  EditionHighlight,
  EditionRecords,
  EditionSummary,
  EventSnapshot,
  FirePaceRecord,
  PublicMessage,
} from "@/lib/types";
import { archiveMessageMarks, FIRE_MARKS } from "@/lib/milestones/engine";
import { editionNumberOf } from "@/lib/utils";

export type ReactionStamp = {
  messageId: string;
  createdAt: string;
};

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

export function formatElapsed(ms: number): string {
  const safe = Math.max(0, ms);
  const minutes = Math.floor(safe / 60_000);
  const hours = Math.floor(minutes / 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (hours >= 1) {
    const rem = minutes % 60;
    if (rem === 0) return hours === 1 ? "1 hour" : `${hours} hours`;
    return `${hours}h ${rem}m`;
  }
  if (minutes >= 1) return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  const seconds = Math.floor(safe / 1000);
  return seconds <= 1 ? "1 second" : `${seconds} seconds`;
}

export function isFireLedgerComplete(
  messages: PublicMessage[],
  stamps: ReactionStamp[] | null | undefined,
  totalReactions: number,
): boolean {
  if (!stamps) return false;
  if (stamps.length !== totalReactions) return false;
  const byMessage = new Map<string, number>();
  for (const stamp of stamps) {
    byMessage.set(stamp.messageId, (byMessage.get(stamp.messageId) ?? 0) + 1);
  }
  return messages.every((message) => (byMessage.get(message.id) ?? 0) === message.reactionCount);
}

function peakBucket(stamps: ReactionStamp[], width: 13 | 16): number {
  if (stamps.length === 0) return 0;
  const buckets = new Map<string, number>();
  for (const stamp of stamps) {
    const key = stamp.createdAt.slice(0, width);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Math.max(...buckets.values());
}

function fastestTo(
  messages: PublicMessage[],
  stamps: ReactionStamp[],
  threshold: number,
): FirePaceRecord | null {
  const times = new Map<string, number[]>();
  for (const stamp of stamps) {
    const at = Date.parse(stamp.createdAt);
    if (!Number.isFinite(at)) continue;
    const list = times.get(stamp.messageId) ?? [];
    list.push(at);
    times.set(stamp.messageId, list);
  }

  let best: FirePaceRecord | null = null;
  for (const message of messages) {
    if (message.reactionCount < threshold) continue;
    const hits = (times.get(message.id) ?? []).sort((a, b) => a - b);
    if (hits.length < threshold) return null;
    const published = Date.parse(message.publishedAt);
    if (!Number.isFinite(published)) continue;
    const elapsedMs = Math.max(0, hits[threshold - 1]! - published);
    if (
      !best ||
      elapsedMs < best.elapsedMs ||
      (elapsedMs === best.elapsedMs && message.publicNumber < best.publicNumber)
    ) {
      best = { publicNumber: message.publicNumber, threshold, elapsedMs };
    }
  }
  return best;
}

export function recordsFromMessages(
  editionNumber: number,
  event: Pick<EventSnapshot, "startsAt" | "endsAt" | "totalMessages" | "totalReactions">,
  messages: PublicMessage[],
  stamps?: ReactionStamp[] | null,
): EditionRecords {
  const ordered = [...messages].sort((a, b) => a.publicNumber - b.publicNumber);
  const byRank = [...messages]
    .filter((message) => message.finalRank != null && message.finalRank > 0)
    .sort((a, b) => (a.finalRank ?? 0) - (b.finalRank ?? 0) || a.publicNumber - b.publicNumber);
  const byFire = [...messages].sort(
    (a, b) =>
      b.reactionCount - a.reactionCount ||
      a.publishedAt.localeCompare(b.publishedAt) ||
      a.publicNumber - b.publicNumber,
  );
  const first = ordered[0] ?? null;
  const last = ordered.at(-1) ?? null;
  const winning = byRank.find((message) => message.finalRank === 1) ?? null;
  const complete = isFireLedgerComplete(messages, stamps, event.totalReactions);
  const ledger = complete ? stamps! : null;

  return {
    editionNumber,
    first: highlightFrom(first),
    last: highlightFrom(last),
    winning: highlightFrom(winning),
    mostReacted: highlightFrom(byFire[0] ?? null),
    milestone100000: highlightFrom(ordered.find((message) => message.publicNumber === 100_000) ?? null),
    milestone250000: highlightFrom(ordered.find((message) => message.publicNumber === 250_000) ?? null),
    milestones: [
      ...archiveMessageMarks()
        .map((value) => {
          const hit = ordered.find((message) => message.publicNumber === value);
          if (!hit) return null;
          return { kind: "message" as const, value, publicNumber: hit.publicNumber };
        })
        .filter((row): row is { kind: "message"; value: number; publicNumber: number } => row !== null),
      ...FIRE_MARKS.filter((value) => event.totalReactions >= value).map((value) => ({
        kind: "fire" as const,
        value,
        publicNumber: null,
      })),
    ],
    totalMessages: event.totalMessages,
    totalReactions: event.totalReactions,
    durationHours: durationHoursOf(event.startsAt, event.endsAt),
    peakMessagesPerMinute: peakMessagesPerMinute(messages),
    peakReactionsPerMinute: ledger ? peakBucket(ledger, 16) : null,
    mostReactionsInOneHour: ledger ? peakBucket(ledger, 13) : null,
    fastestTo100: ledger ? fastestTo(messages, ledger, 100) : null,
    fastestTo1000: ledger ? fastestTo(messages, ledger, 1_000) : null,
    fastestTo10000: ledger ? fastestTo(messages, ledger, 10_000) : null,
    top100: byRank.slice(0, 100).map((message) => highlightFrom(message)!),
    fireLedgerComplete: complete,
  };
}

function pickFastest(
  books: EditionRecords[],
  key: "fastestTo100" | "fastestTo1000" | "fastestTo10000",
): (FirePaceRecord & { editionNumber: number }) | null {
  let best: (FirePaceRecord & { editionNumber: number }) | null = null;
  for (const book of books) {
    const row = book[key];
    if (!row) continue;
    if (
      !best ||
      row.elapsedMs < best.elapsedMs ||
      (row.elapsedMs === best.elapsedMs && book.editionNumber < best.editionNumber)
    ) {
      best = { ...row, editionNumber: book.editionNumber };
    }
  }
  return best;
}

export function allTimeFromEditions(
  editions: EditionSummary[],
  extras: {
    mostFireOnMessage?: AllTimeRecords["mostFireOnMessage"];
    peaks?: Map<number, number>;
    books?: EditionRecords[];
  } = {},
): AllTimeRecords {
  const books = extras.books ?? [];
  if (editions.length === 0) {
    return {
      mostMessages: null,
      mostReactions: null,
      mostFireOnMessage: extras.mostFireOnMessage ?? null,
      largestFinalMinute: null,
      largestReactionMinute: null,
      largestReactionHour: null,
      fastestTo100: null,
      fastestTo1000: null,
      fastestTo10000: null,
    };
  }
  const mostMessages = [...editions].sort((a, b) => b.totalMessages - a.totalMessages)[0]!;
  const mostReactions = [...editions].sort((a, b) => b.totalReactions - a.totalReactions)[0]!;
  let mostFire = extras.mostFireOnMessage ?? null;
  if (!mostFire) {
    for (const book of books) {
      if (!book.mostReacted) continue;
      if (!mostFire || book.mostReacted.reactionCount > mostFire.reactionCount) {
        mostFire = {
          editionNumber: book.editionNumber,
          publicNumber: book.mostReacted.publicNumber,
          reactionCount: book.mostReacted.reactionCount,
        };
      }
    }
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
  }
  let largestFinalMinute: AllTimeRecords["largestFinalMinute"] = null;
  for (const edition of editions) {
    const peak = extras.peaks?.get(edition.editionNumber) ??
      books.find((book) => book.editionNumber === edition.editionNumber)?.peakMessagesPerMinute ??
      0;
    if (peak > 0 && (!largestFinalMinute || peak > largestFinalMinute.peakMessagesPerMinute)) {
      largestFinalMinute = { editionNumber: edition.editionNumber, peakMessagesPerMinute: peak };
    }
  }
  let largestReactionMinute: AllTimeRecords["largestReactionMinute"] = null;
  let largestReactionHour: AllTimeRecords["largestReactionHour"] = null;
  for (const book of books) {
    if (
      book.peakReactionsPerMinute != null &&
      book.peakReactionsPerMinute > 0 &&
      (!largestReactionMinute || book.peakReactionsPerMinute > largestReactionMinute.peakReactionsPerMinute)
    ) {
      largestReactionMinute = {
        editionNumber: book.editionNumber,
        peakReactionsPerMinute: book.peakReactionsPerMinute,
      };
    }
    if (
      book.mostReactionsInOneHour != null &&
      book.mostReactionsInOneHour > 0 &&
      (!largestReactionHour || book.mostReactionsInOneHour > largestReactionHour.mostReactionsInOneHour)
    ) {
      largestReactionHour = {
        editionNumber: book.editionNumber,
        mostReactionsInOneHour: book.mostReactionsInOneHour,
      };
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
    largestReactionMinute,
    largestReactionHour,
    fastestTo100: pickFastest(books, "fastestTo100"),
    fastestTo1000: pickFastest(books, "fastestTo1000"),
    fastestTo10000: pickFastest(books, "fastestTo10000"),
  };
}

export function editionNumberFromEvent(event: EventSnapshot): number {
  return editionNumberOf(event);
}
