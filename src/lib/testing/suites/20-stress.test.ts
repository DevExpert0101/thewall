import { afterEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { assignFinalRanks } from "@/lib/ranking";
import { listSimulatedEditions, simulatedMessageList } from "@/lib/data/simulation";
import { getPublicEnv } from "@/lib/env";
import {
  addReactions,
  claimWithKey,
  closeForReview,
  discloseResults,
  monumentCatalog,
  openNextAutomatedWall,
  openShortLiveWall,
  payAndPublish,
  reactOnce,
  resetAutomatedWall,
} from "@/lib/testing/harness";
import { createWallKey } from "@/lib/crypto";

afterEach(() => {
  resetAutomatedWall();
});

const PARTICIPANTS = Math.min(Number(process.env.STRESS_MESSAGES || 80), 1000);

describe("suite 20 — full project stress", () => {
  it("keeps three existing inscriptions and adds exactly one more", async () => {
    resetAutomatedWall();
    for (let wall = 1; wall <= 3; wall += 1) {
      if (wall === 1) openShortLiveWall();
      else openNextAutomatedWall(`PRIOR ${wall}`);
      payAndPublish(`Prior canvas sentence ${wall}.`);
      await discloseResults();
    }
    expect(monumentCatalog()).toHaveLength(3);
    const prior = monumentCatalog().map((entry) => ({
      text: entry.text,
      x: entry.x,
      y: entry.y,
      position: entry.position,
    }));

    openNextAutomatedWall("WALL FOUR");
    const marks = [];
    for (let i = 0; i < PARTICIPANTS; i += 1) {
      marks.push(payAndPublish(`Stress participant ${i + 1}.`));
    }
    const leader = marks[0]!;
    const chase = marks[1]!;
    addReactions(leader.messageId, 80);
    addReactions(chase.messageId, 79);
    expect(() => reactOnce(leader.messageId, "dup-identity")).not.toThrow();
    expect(() => reactOnce(leader.messageId, "dup-identity")).toThrow(AppError);
    expect(() => reactOnce("missing-id", "ghost")).toThrow(AppError);

    const ranked = assignFinalRanks(simulatedMessageList());
    expect(ranked.find((row) => row.text === leader.text)?.finalRank).toBe(1);

    closeForReview();
    expect(() => payAndPublish("After the bell.")).toThrow(AppError);
    expect(() => reactOnce(chase.messageId, "too-late")).toThrow(AppError);

    await discloseResults();
    await discloseResults().catch(() => undefined);
    await discloseResults().catch(() => undefined);

    expect(monumentCatalog()).toHaveLength(4);
    expect(listSimulatedEditions()).toHaveLength(4);
    expect(monumentCatalog()[3]?.text).toBe(leader.text);
    for (let i = 0; i < 3; i += 1) {
      expect(monumentCatalog()[i]?.text).toBe(prior[i]?.text);
      expect(monumentCatalog()[i]?.x).toBe(prior[i]?.x);
      expect(monumentCatalog()[i]?.y).toBe(prior[i]?.y);
      expect(monumentCatalog()[i]?.position).toBe(prior[i]?.position);
    }
    expect(claimWithKey(leader.publicNumber, leader.wallKey).messageId).toBeTruthy();
    expect(() => claimWithKey(leader.publicNumber, createWallKey())).toThrow(AppError);
    expect(JSON.stringify(getPublicEnv())).not.toContain(leader.wallKey);
  }, 60_000);
});
