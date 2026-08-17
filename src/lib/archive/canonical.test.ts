import { describe, expect, it } from "vitest";
import {
  ARCHIVE_SCHEMA,
  FORBIDDEN_ARCHIVE_KEYS,
  archiveBodyOf,
  buildCanonicalArchive,
  merkleRoot,
  serializeCanonicalArchive,
} from "@/lib/archive/canonical";
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
  treasuryAddress: "0x1111111111111111111111111111111111111111",
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
    expect(first.archiveHash).toBe(sha256Hex(serializeCanonicalArchive(archiveBodyOf(first))));
  });

  it("uses an empty-tree hash when there are no leaves", () => {
    expect(merkleRoot([])).toBe(sha256Hex(""));
  });

  it("never seals wallets, keys, IPs, user ids, or payment metadata", () => {
    const dirty = {
      ...message(1, { finalRank: 1 }),
      walletAddress: "0xabcabcabcabcabcabcabcabcabcabcabcabcabca",
      claimKey: "WALL-KEY-SECRET",
      ownershipHash: "deadbeefdeadbeef",
      ipAddress: "203.0.113.44",
      userId: "user-uuid-should-not-leak",
      moderationNote: "internal strike reason",
      paymentTx: "0xpaypaypaypaypaypaypaypaypaypaypaypaypaypaypaypaypaypaypaypaypayp",
    } as PublicMessage & Record<string, string>;
    const sealed = buildCanonicalArchive({ event, messages: [dirty, message(2)] });
    const blob = serializeCanonicalArchive(archiveBodyOf(sealed));
    expect(blob).not.toMatch(/0xabcabc|WALL-KEY-SECRET|deadbeef|203\.0\.113\.44|user-uuid-should-not-leak|internal strike|0xpaypay/i);
    expect(blob).not.toMatch(/0x1111111111111111111111111111111111111111/);
    expect(Object.keys(sealed.messages[0] ?? {}).sort()).toEqual([
      "finalRank",
      "isRemoved",
      "publicNumber",
      "publishedAt",
      "reactionCount",
      "text",
    ]);
    for (const key of FORBIDDEN_ARCHIVE_KEYS) {
      expect(blob.includes(`"${key}"`)).toBe(false);
    }
  });
});
