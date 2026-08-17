import { describe, expect, it } from "vitest";
import {
  allTimeFromEditions,
  formatElapsed,
  isFireLedgerComplete,
  recordsFromMessages,
  type ReactionStamp,
} from "@/lib/archive/records";
import type { EditionSummary, EventSnapshot, PublicMessage } from "@/lib/types";

function message(n: number, extra: Partial<PublicMessage> = {}): PublicMessage {
  return {
    id: `m${n}`,
    eventId: "evt",
    publicNumber: n,
    text: `Sentence ${n}.`,
    isRemoved: false,
    reactionCount: 1,
    publishedAt: "2026-08-13T10:00:00.000Z",
    finalRank: null,
    ...extra,
  };
}

const event: Pick<EventSnapshot, "startsAt" | "endsAt" | "totalMessages" | "totalReactions"> = {
  startsAt: "2026-08-12T18:00:00.000Z",
  endsAt: "2026-08-13T18:00:00.000Z",
  totalMessages: 18,
  totalReactions: 401,
};

function stampsFor(messageId: string, count: number, start: string): ReactionStamp[] {
  const origin = Date.parse(start);
  return Array.from({ length: count }, (_, index) => ({
    messageId,
    createdAt: new Date(origin + index * 1_000).toISOString(),
  }));
}

describe("edition records milestones", () => {
  it("records only marks that exist in the sealed dataset", () => {
    const records = recordsFromMessages(1, event, [message(1), message(10), message(18)]);
    expect(records.milestones).toEqual([
      { kind: "message", value: 1, publicNumber: 1 },
      { kind: "message", value: 10, publicNumber: 10 },
    ]);
    expect(records.milestone100000).toBeNull();
  });

  it("does not invent a 100,000th voice or a million fires", () => {
    const records = recordsFromMessages(
      1,
      { ...event, totalMessages: 18, totalReactions: 9_999 },
      [message(1), message(10)],
    );
    expect(records.milestones.some((row) => row.value === 100_000)).toBe(false);
    expect(records.milestones.some((row) => row.kind === "fire")).toBe(false);
  });

  it("keeps a fire mark when the sealed total actually crossed it", () => {
    const records = recordsFromMessages(
      1,
      { ...event, totalReactions: 10_000 },
      [message(1)],
    );
    expect(records.milestones).toContainEqual({ kind: "fire", value: 10_000, publicNumber: null });
  });
});

describe("record book facts", () => {
  it("uses official numbers, ranks, and publish times only", () => {
    const records = recordsFromMessages(
      1,
      { ...event, totalMessages: 3, totalReactions: 9 },
      [
        message(1, { reactionCount: 2, finalRank: 2, publishedAt: "2026-08-13T10:00:00.000Z" }),
        message(2, { reactionCount: 6, finalRank: 1, publishedAt: "2026-08-13T10:00:30.000Z" }),
        message(3, { reactionCount: 1, finalRank: 3, publishedAt: "2026-08-13T10:01:00.000Z" }),
      ],
    );
    expect(records.first?.publicNumber).toBe(1);
    expect(records.last?.publicNumber).toBe(3);
    expect(records.winning?.publicNumber).toBe(2);
    expect(records.mostReacted?.publicNumber).toBe(2);
    expect(records.top100.map((row) => row.publicNumber)).toEqual([2, 1, 3]);
    expect(records.peakMessagesPerMinute).toBe(2);
    expect(records.fastestTo100).toBeNull();
    expect(records.peakReactionsPerMinute).toBeNull();
    expect(records.fireLedgerComplete).toBe(false);
  });

  it("does not name a winner from fire count when ranks were never sealed", () => {
    const records = recordsFromMessages(1, event, [
      message(4, { reactionCount: 67 }),
      message(1, { reactionCount: 3 }),
    ]);
    expect(records.winning).toBeNull();
    expect(records.mostReacted?.publicNumber).toBe(4);
    expect(records.top100).toEqual([]);
  });

  it("omits fire-speed records when the reaction ledger is missing or incomplete", () => {
    const messages = [message(4, { reactionCount: 120 })];
    const partial = stampsFor("m4", 80, "2026-08-13T10:01:00.000Z");
    expect(isFireLedgerComplete(messages, partial, 120)).toBe(false);
    const records = recordsFromMessages(
      1,
      { ...event, totalMessages: 1, totalReactions: 120 },
      messages,
      partial,
    );
    expect(records.fastestTo100).toBeNull();
    expect(records.mostReactionsInOneHour).toBeNull();
    expect(records.peakReactionsPerMinute).toBeNull();
  });

  it("computes fastest-to-100 and reaction windows only from a complete ledger", () => {
    const slow = message(1, { reactionCount: 100, publishedAt: "2026-08-13T10:00:00.000Z" });
    const fast = message(4, { reactionCount: 100, publishedAt: "2026-08-13T11:00:00.000Z" });
    const stamps = [
      ...stampsFor(slow.id, 100, "2026-08-13T10:30:00.000Z"),
      ...stampsFor(fast.id, 100, "2026-08-13T11:05:00.000Z"),
    ];
    const records = recordsFromMessages(
      1,
      { ...event, totalMessages: 2, totalReactions: 200 },
      [slow, fast],
      stamps,
    );
    expect(records.fireLedgerComplete).toBe(true);
    expect(records.fastestTo100?.publicNumber).toBe(4);
    expect(records.fastestTo100?.elapsedMs).toBe(5 * 60_000 + 99_000);
    expect(records.fastestTo1000).toBeNull();
    expect(records.peakReactionsPerMinute).toBe(60);
    expect(records.mostReactionsInOneHour).toBe(100);
    expect(formatElapsed(records.fastestTo100!.elapsedMs)).toBe("6 minutes");
  });
});

describe("all-time fold", () => {
  it("keeps edition links and does not invent a reaction-minute record", () => {
    const editions: EditionSummary[] = [
      {
        id: "a",
        editionNumber: 1,
        slug: "the-wall",
        title: "THE WALL",
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        finalizedAt: event.endsAt,
        totalMessages: 18,
        totalReactions: 401,
        archiveHash: null,
        merkleRoot: null,
        archiveUri: null,
        proofTx: null,
        winning: null,
      },
    ];
    const book = recordsFromMessages(1, event, [message(1), message(10)]);
    const all = allTimeFromEditions(editions, { books: [book], peaks: new Map([[1, 3]]) });
    expect(all.mostMessages?.editionNumber).toBe(1);
    expect(all.largestFinalMinute).toEqual({ editionNumber: 1, peakMessagesPerMinute: 3 });
    expect(all.largestReactionMinute).toBeNull();
    expect(all.fastestTo100).toBeNull();
  });
});
