import { afterEach, describe, expect, it } from "vitest";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { assignFinalRanks } from "@/lib/ranking";
import { getPublicEnv } from "@/lib/env";
import { createWallKey, hashWallKey } from "@/lib/crypto";
import {
  createSimulatedIntent,
  currentSimulatedEvent,
  fulfillSimulatedPayment,
  listSimulatedEditions,
  simulatedMessageList,
  startSimulatedWall,
} from "@/lib/data/simulation";
import {
  addReactions,
  claimWithKey,
  closeForReview,
  createUnpaidIntent,
  discloseResults,
  monumentCatalog,
  openNextAutomatedWall,
  openShortLiveWall,
  payAndPublish,
  reactOnce,
  resetAutomatedWall,
  sealAutomatedWall,
} from "@/lib/testing/harness";

afterEach(() => {
  resetAutomatedWall();
});

function codeOf(fn: () => unknown) {
  try {
    fn();
  } catch (error) {
    return (error as AppError).code;
  }
  throw new Error("expected failure");
}

function sealNamedWall(title: string, sentence: string) {
  if (monumentCatalog().length === 0) {
    openShortLiveWall();
  } else {
    openNextAutomatedWall(title);
  }
  const mark = payAndPublish(sentence);
  addReactions(mark.messageId, 80);
  sealAutomatedWall();
  return mark;
}

describe("suite 23 — complete simulated Wall", () => {
  it("keeps three carved winners, then adds exactly one more from Wall #4", async () => {
    resetAutomatedWall();
    expect(monumentCatalog()).toEqual([]);

    const first = sealNamedWall("QA WALL 1", "Permanent sentence one.");
    const second = sealNamedWall("QA WALL 2", "Permanent sentence two.");
    const third = sealNamedWall("QA WALL 3", "Permanent sentence three.");
    const prior = structuredClone(monumentCatalog());
    expect(prior).toHaveLength(3);
    expect(prior.map((row) => row.text)).toEqual([first.text, second.text, third.text]);

    const upcoming = startSimulatedWall({
      title: "QA WALL 4",
      durationMinutes: 5,
      startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    expect(upcoming.phase).toBe("upcoming");
    expect(
      codeOf(() =>
        createSimulatedIntent({
          text: "Too early.",
          userId: "local-sim-early",
          claimSecretHash: hashWallKey(createWallKey()),
        }),
      ),
    ).toBe(ERROR_CODES.EVENT_UPCOMING);

    const live = startSimulatedWall({
      title: "QA WALL 4",
      durationMinutes: 5,
      startsAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(live.phase).toBe("live");

    const failed = createUnpaidIntent("Failed checkout must not publish.");
    expect(
      codeOf(() =>
        fulfillSimulatedPayment({
          intentId: failed.checkout.intentId,
          userId: failed.userId,
          paymentId: `0x${"99".repeat(32)}`,
        }),
      ),
    ).toBe(ERROR_CODES.PAYMENT_FAILED);

    const runnerUp = payAndPublish("Close second on Wall four.");
    const winner = payAndPublish("Close first on Wall four.");
    addReactions(runnerUp.messageId, 90);
    addReactions(winner.messageId, 91);
    expect(reactOnce(winner.messageId, "local-sim-dup-winner")).toBeGreaterThan(91);
    expect(codeOf(() => reactOnce(winner.messageId, "local-sim-dup-winner"))).toBe(
      ERROR_CODES.DUPLICATE_REACTION,
    );

    const crowd: string[] = [];
    for (let i = 0; i < 24; i += 1) {
      crowd.push(payAndPublish(`Wall four crowd ${i + 1}.`).text);
    }
    const numbers = simulatedMessageList().map((row) => row.publicNumber);
    expect(new Set(numbers).size).toBe(numbers.length);

    const ranked = assignFinalRanks(simulatedMessageList());
    const firstPlace = ranked.find((row) => row.finalRank === 1);
    expect(firstPlace?.text).toBe(winner.text);

    const closed = closeForReview();
    expect(closed.phase).toBe("finalizing");
    expect(
      codeOf(() =>
        createSimulatedIntent({
          text: "Late write.",
          userId: "local-sim-late",
          claimSecretHash: hashWallKey(createWallKey()),
        }),
      ),
    ).toBe(ERROR_CODES.EVENT_ENDED);
    expect(codeOf(() => reactOnce(winner.messageId, "local-sim-late-fire"))).toBe(
      ERROR_CODES.EVENT_ENDED,
    );

    const sealed = await discloseResults();
    expect(sealed.phase).toBe("archived");
    await expect(discloseResults()).rejects.toBeInstanceOf(AppError);
    await expect(discloseResults()).rejects.toBeInstanceOf(AppError);

    const carved = monumentCatalog();
    expect(carved).toHaveLength(4);
    expect(carved[0]?.text).toBe(prior[0]?.text);
    expect(carved[0]?.x).toBe(prior[0]?.x);
    expect(carved[0]?.y).toBe(prior[0]?.y);
    expect(carved[0]?.position).toBe(prior[0]?.position);
    expect(carved[1]?.text).toBe(prior[1]?.text);
    expect(carved[2]?.text).toBe(prior[2]?.text);
    expect(carved[3]?.text).toBe(winner.text);
    expect(new Set(carved.map((row) => row.position)).size).toBe(4);
    expect(listSimulatedEditions()).toHaveLength(4);
    expect(listSimulatedEditions()[3]?.winning?.text).toBe(winner.text);

    const claim = claimWithKey(winner.publicNumber, winner.wallKey);
    expect(claim.messageId).toBeTruthy();
    expect(codeOf(() => claimWithKey(winner.publicNumber, createWallKey()))).toBe(
      ERROR_CODES.CLAIM_INVALID,
    );

    const publicSurface = JSON.stringify({
      event: currentSimulatedEvent(),
      env: getPublicEnv(),
      crowd,
    });
    expect(publicSurface).not.toContain(winner.wallKey);
    expect(publicSurface).not.toMatch(/SERVICE_ROLE|claimSecretHash|sk_live/i);
    expect(failed.text).not.toBe(winner.text);
  });
});
