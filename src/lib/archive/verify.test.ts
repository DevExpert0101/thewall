import { describe, expect, it } from "vitest";
import { buildArchiveManifest, MANIFEST_SCHEMA } from "@/lib/archive/manifest";
import { buildCanonicalArchive } from "@/lib/archive/canonical";
import { fingerprintsMatch, formatArchiveFingerprint } from "@/lib/archive/verify";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

const event: EventSnapshot = {
  id: "local",
  slug: "the-wall",
  title: "THE WALL",
  startsAt: "2026-08-08T00:00:00.000Z",
  endsAt: "2026-08-09T00:00:00.000Z",
  archivedAt: "2026-08-09T00:00:00.000Z",
  finalizedAt: "2026-08-09T00:00:00.000Z",
  phase: "archived",
  serverNow: "2026-08-09T01:00:00.000Z",
  totalMessages: 1,
  totalReactions: 3,
  treasuryAddress: null,
  network: "base-sepolia",
  priceUsdc: "1.00",
  editionNumber: 1,
};

const message: PublicMessage = {
  id: "m1",
  eventId: "local",
  publicNumber: 1,
  text: "A public sentence.",
  isRemoved: false,
  reactionCount: 3,
  publishedAt: "2026-08-08T12:00:00.000Z",
  finalRank: 1,
};

describe("archive fingerprints", () => {
  it("shortens a hash the way the verification plaque reads it", () => {
    expect(formatArchiveFingerprint("9bf2aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa812")).toBe(
      "9BF2...A812",
    );
    expect(fingerprintsMatch("9BF2aa", "9bf2aa")).toBe(true);
    expect(fingerprintsMatch("aaaa", "bbbb")).toBe(false);
  });
});

describe("archive manifest", () => {
  it("records hashes and site copies without private fields", () => {
    const archive = buildCanonicalArchive({ event, messages: [message] });
    const manifest = buildArchiveManifest({
      archive,
      replicaUri: "https://example.com/replica/001.json",
    });
    expect(manifest.schema).toBe(MANIFEST_SCHEMA);
    expect(manifest.archiveHash).toBe(archive.archiveHash);
    expect(manifest.merkleRoot).toBe(archive.merkleRoot);
    expect(manifest.copies.some((copy) => copy.kind === "site")).toBe(true);
    expect(manifest.copies.some((copy) => copy.uri.includes("/replica/001.json"))).toBe(true);
    expect(JSON.stringify(manifest)).not.toMatch(/wallet|claimKey|ownership|ipAddress|userId|payment/i);
  });
});
