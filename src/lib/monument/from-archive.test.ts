import { describe, expect, it } from "vitest";
import { ARCHIVAL_REMOVAL_TEXT } from "@/lib/constants";
import { monumentFromSealedWall } from "@/lib/monument/from-archive";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

const event: EventSnapshot = {
  id: "event-7",
  slug: "007",
  title: "WALL OF HOPE",
  startsAt: "2026-08-08T00:00:00.000Z",
  endsAt: "2026-08-09T00:00:00.000Z",
  archivedAt: "2026-08-09T00:00:05.000Z",
  finalizedAt: "2026-08-09T00:00:05.000Z",
  phase: "archived",
  serverNow: "2026-08-09T00:00:05.000Z",
  totalMessages: 3,
  totalReactions: 15,
  treasuryAddress: null,
  network: "base-sepolia",
  priceUsdc: "1.00",
  editionNumber: 7,
  themeQuestion: "What should remain?",
  archiveHash: "a".repeat(64),
};

function row(n: number, extra: Partial<PublicMessage> = {}): PublicMessage {
  return {
    id: `msg-${n}`,
    eventId: event.id,
    publicNumber: n,
    text: `Sentence ${n}`,
    isRemoved: false,
    reactionCount: n,
    publishedAt: `2026-08-08T0${n}:00:00.000Z`,
    finalRank: null,
    ...extra,
  };
}

describe("Monument from a sealed Wall", () => {
  it("references the original inscription and Wall", () => {
    const entry = monumentFromSealedWall({
      monumentNumber: 7,
      event,
      messages: [
        row(4291, { reactionCount: 491283, finalRank: 1, text: "The future needs people willing to believe it deserves one." }),
        row(2, { reactionCount: 481002, finalRank: 2 }),
      ],
    });
    expect(entry?.monumentNumber).toBe(7);
    expect(entry?.position).toBe(7);
    expect(entry?.width).toBeGreaterThan(0);
    expect(entry?.height).toBeGreaterThan(0);
    expect(entry?.x).toBeGreaterThanOrEqual(0);
    expect(entry?.sentenceSnapshot).toMatch(/the future needs people/i);
    expect(entry?.editionNumber).toBe(7);
    expect(entry?.originalPublicNumber).toBe(4291);
    expect(entry?.messageId).toBe("msg-4291");
    expect(entry?.eventId).toBe("event-7");
    expect(entry?.winningMargin).toBe(10281);
    expect(entry?.themeTitle).toBe("WALL OF HOPE");
    expect(entry?.themeQuestion).toBe("What should remain?");
  });

  it("gives #1 to the next living sentence when the loudest was removed before seal", () => {
    const entry = monumentFromSealedWall({
      monumentNumber: 1,
      event,
      messages: [
        row(8, { reactionCount: 90, isRemoved: true, text: ARCHIVAL_REMOVAL_TEXT, finalRank: null }),
        row(3, { reactionCount: 40, text: "Still standing.", finalRank: 1 }),
        row(4, { reactionCount: 10, text: "Third.", finalRank: 2 }),
      ],
    });
    expect(entry?.originalPublicNumber).toBe(3);
    expect(entry?.text).toBe("Still standing.");
    expect(entry?.isRemoved).toBe(false);
    expect(entry?.winningMargin).toBe(30);
  });

  it("keeps a removed Victor number and redacts the sentence", () => {
    const entry = monumentFromSealedWall({
      monumentNumber: 1,
      event,
      messages: [row(8, { finalRank: 1, isRemoved: true, text: ARCHIVAL_REMOVAL_TEXT, reactionCount: 9 })],
    });
    expect(entry?.originalPublicNumber).toBe(8);
    expect(entry?.isRemoved).toBe(true);
    expect(entry?.text).toBe(ARCHIVAL_REMOVAL_TEXT);
  });
});
