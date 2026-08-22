import { afterEach, describe, expect, it } from "vitest";
import {
  archiveBodyOf,
  buildCanonicalArchive,
  serializeCanonicalArchive,
} from "@/lib/archive/canonical";
import { fingerprintsMatch } from "@/lib/archive/verify";
import { sha256Hex } from "@/lib/crypto";
import { getSimulatedEdition, listSimulatedEditions } from "@/lib/data/simulation";
import {
  addReactions,
  monumentCatalog,
  openShortLiveWall,
  payAndPublish,
  resetAutomatedWall,
  sealAutomatedWall,
} from "@/lib/testing/harness";

afterEach(() => {
  resetAutomatedWall();
});

describe("suite 13 — archive integrity", () => {
  it("matches the stored hash and fails if the copy is altered", () => {
    openShortLiveWall();
    const winner = payAndPublish("Archive winner sentence.");
    addReactions(winner.messageId, 80);
    sealAutomatedWall();
    const edition = listSimulatedEditions()[0];
    expect(edition?.archiveHash).toMatch(/^[0-9a-f]{64}$/);
    expect(monumentCatalog()[0]?.text).toBe(winner.text);

    const snapshot = getSimulatedEdition(edition?.editionNumber ?? 1);
    expect(snapshot).toBeTruthy();
    const sealed = buildCanonicalArchive({
      event: snapshot!.event,
      messages: snapshot!.messages,
    });
    expect(sealed.archiveHash).toBe(edition?.archiveHash);
    expect(sealed.winningPublicNumber).toBe(winner.publicNumber);
    const body = archiveBodyOf(sealed);
    const recomputed = sha256Hex(serializeCanonicalArchive(body));
    expect(fingerprintsMatch(sealed.archiveHash, recomputed)).toBe(true);

    const tamperedText = structuredClone(body);
    tamperedText.messages[0] = { ...tamperedText.messages[0]!, text: "altered winner" };
    expect(sha256Hex(serializeCanonicalArchive(tamperedText))).not.toBe(sealed.archiveHash);

    const tamperedFires = structuredClone(body);
    tamperedFires.messages[0] = { ...tamperedFires.messages[0]!, reactionCount: 999 };
    expect(sha256Hex(serializeCanonicalArchive(tamperedFires))).not.toBe(sealed.archiveHash);
  });
});
