import { describe, expect, it } from "vitest";
import { ARCHIVE_SCHEMA, buildCanonicalArchive, merkleRoot } from "@/lib/archive/canonical";
import { sha256Hex } from "@/lib/crypto";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

const event: EventSnapshot = {
  id: "local",
  slug: "the-wall",
  title: "THE WALL",
  startsAt: "2026-08-12T18:00:00.000Z",
  endsAt: "2026-08-13T18:00:00.000Z",
  archivedAt: "2026-08-13T18:00:00.000Z",
  finalizedAt: "2026-08-13T18:00:00.000Z",
  phase: "archived",
  serverNow: "2026-08-13T19:00:00.000Z",
  totalMessages: 2,
  totalReactions: 5,
  treasuryAddress: null,
  network: "base-sepolia",
  priceUsdc: "1.00",
  editionNumber: 1,
};

function message(n: number, extra: Partial<PublicMessage> = {}): PublicMessage {
  return {
    id: `m${n}`,
    eventId: "local",
    publicNumber: n,
    text: `Sentence ${n}.`,
    isRemoved: false,
    reactionCount: n,
    publishedAt: `2026-08-13T10:00:0${n}.000Z`,
    finalRank: 3 - n,
    ...extra,
  };
}

describe("canonical archive", () => {
  it("builds a stable hash and merkle root from the public dataset", () => {
    const messages = [message(2, { finalRank: 2 }), message(1, { finalRank: 1, reactionCount: 9 })];
    const first = buildCanonicalArchive({ event, messages });
    const second = buildCanonicalArchive({ event, messages: [...messages].reverse() });
    expect(first.schema).toBe(ARCHIVE_SCHEMA);
    expect(first.edition).toBe(1);
    expect(first.messages.map((row) => row.publicNumber)).toEqual([1, 2]);
    expect(first.archiveHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.merkleRoot).toMatch(/^[0-9a-f]{64}$/);
    expect(first.archiveHash).toBe(second.archiveHash);
    expect(first.merkleRoot).toBe(second.merkleRoot);
    expect(first.winningPublicNumber).toBe(1);
  });

  it("uses an empty-tree hash when there are no leaves", () => {
    expect(merkleRoot([])).toBe(sha256Hex(""));
  });
});
