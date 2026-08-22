import { afterEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import {
  createSimulatedIntent,
  currentSimulatedEvent,
} from "@/lib/data/simulation";
import { createWallKey, hashWallKey } from "@/lib/crypto";
import {
  addReactions,
  closeForReview,
  discloseResults,
  monumentCatalog,
  openShortLiveWall,
  payAndPublish,
  reactOnce,
  resetAutomatedWall,
} from "@/lib/testing/harness";

afterEach(() => {
  resetAutomatedWall();
});

describe("suite 16 — finalization failure recovery", () => {
  it("stays CLOSED after ends_at and only seals once on retry", async () => {
    openShortLiveWall();
    const winner = payAndPublish("Closed before the seal.");
    addReactions(winner.messageId, 80);
    expect(closeForReview().phase).toBe("finalizing");
    expect(currentSimulatedEvent().phase).toBe("finalizing");
    expect(monumentCatalog()).toHaveLength(0);
    expect(() =>
      createSimulatedIntent({
        text: "Reopen attempt.",
        userId: "nope",
        claimSecretHash: hashWallKey(createWallKey()),
      }),
    ).toThrow(AppError);
    expect(() => reactOnce(winner.messageId, "nope-fire")).toThrow(AppError);

    const first = await discloseResults();
    expect(first.phase).toBe("archived");
    expect(monumentCatalog()).toHaveLength(1);
    expect(monumentCatalog()[0]?.text).toBe(winner.text);
    const plot = structuredClone(monumentCatalog()[0]);
    await expect(discloseResults()).rejects.toBeInstanceOf(AppError);
    expect(monumentCatalog()).toHaveLength(1);
    expect(monumentCatalog()[0]?.text).toBe(plot?.text);
    expect(monumentCatalog()[0]?.position).toBe(plot?.position);
    expect(currentSimulatedEvent().phase).toBe("archived");
  });
});
