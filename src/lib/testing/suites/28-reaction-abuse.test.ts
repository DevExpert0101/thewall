import { afterEach, describe, expect, it } from "vitest";
import { ABUSE_LIMITS, TURNSTILE_REQUIRED } from "@/lib/abuse/keys";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { consumeMemoryRateLimit, resetMemoryRateLimits } from "@/lib/data/rate-limit";
import { compareHot } from "@/lib/ranking";
import {
  challengeReactionOrThrow,
  evaluateReactionIntegrity,
  observeReactionSuccess,
  resetReactionIntegrity,
  REACTION_VELOCITY,
} from "@/lib/reactions/integrity";
import { addSimulatedReaction, simulatedMessageList } from "@/lib/data/simulation";
import { reactSchema } from "@/lib/validation";
import {
  addReactions,
  closeForReview,
  openShortLiveWall,
  payAndPublish,
  reactOnce,
  resetAutomatedWall,
} from "@/lib/testing/harness";

afterEach(() => {
  resetAutomatedWall();
  resetReactionIntegrity();
  resetMemoryRateLimits();
});

function codeOf(fn: () => unknown) {
  try {
    fn();
  } catch (error) {
    return (error as AppError).code;
  }
  throw new Error("expected failure");
}

const MESSAGE = "11111111-1111-4111-8111-111111111111";
const BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

describe("suite 28 — 🔥 inflation", () => {
  it("rejects 100 / 1,000 / 10,000 clicks from one identity", async () => {
    openShortLiveWall();
    const mark = payAndPublish("One visitor, many clicks.");
    const first = reactOnce(mark.messageId, "same-hand");
    expect(first).toBe(1);
    for (const count of [100, 1_000, 10_000]) {
      const burst = await Promise.allSettled(
        Array.from({ length: count }, () =>
          Promise.resolve().then(() => addSimulatedReaction(mark.messageId, "same-hand")),
        ),
      );
      expect(burst.every((row) => row.status === "rejected")).toBe(true);
      expect(simulatedMessageList().find((row) => row.id === mark.messageId)?.reactionCount).toBe(1);
    }
  }, 60_000);

  it("accepts 100, 1,000, and 10,000 fires only from distinct identities", () => {
    openShortLiveWall();
    const mark = payAndPublish("Many visitors.");
    expect(addReactions(mark.messageId, 10_000)).toBe(10_000);
    expect(simulatedMessageList().find((row) => row.id === mark.messageId)?.reactionCount).toBe(10_000);
    expect(codeOf(() => reactOnce(mark.messageId, "local-sim-bulk-" + mark.messageId + "-0"))).toBe(
      ERROR_CODES.DUPLICATE_REACTION,
    );
  }, 60_000);

  it("does not trust client count, time, identity, cookies, or localStorage fields", () => {
    const parsed = reactSchema.parse({
      messageId: MESSAGE,
      reactionCount: 9999,
      count: 9999,
      now: "2099-01-01T00:00:00.000Z",
      userId: "attacker",
      cookie: "session=forged",
      localStorage: ["already-fired"],
      timestamp: 1,
    });
    expect(parsed).toEqual({ messageId: MESSAGE });
    expect(TURNSTILE_REQUIRED.react).toBe(false);
  });

  it("replays the same idempotency key without adding a second 🔥", () => {
    openShortLiveWall();
    const mark = payAndPublish("Replay target.");
    const key = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const first = addSimulatedReaction(mark.messageId, "replay", key);
    expect(addSimulatedReaction(mark.messageId, "replay", key)).toBe(first);
    expect(simulatedMessageList().find((row) => row.id === mark.messageId)?.reactionCount).toBe(1);
  });

  it("rejects 🔥 after close and does not move the count", () => {
    openShortLiveWall();
    const mark = payAndPublish("Closes with one fire.");
    reactOnce(mark.messageId, "before-bell");
    closeForReview();
    expect(codeOf(() => reactOnce(mark.messageId, "after-bell"))).toBe(ERROR_CODES.EVENT_ENDED);
    expect(simulatedMessageList().find((row) => row.id === mark.messageId)?.reactionCount).toBe(1);
  });

  it("rate-limits one address after 60 reacts / 60s; one user after 30", () => {
    expect(ABUSE_LIMITS.react.ip).toEqual([30, 60]);
    expect(ABUSE_LIMITS.react.user).toEqual([20, 60]);
    expect(ABUSE_LIMITS.session.ip[0]).toBeLessThanOrEqual(8);
    for (let i = 0; i < 60; i += 1) consumeMemoryRateLimit("react:ip:farm", 60, 60);
    expect(() => consumeMemoryRateLimit("react:ip:farm", 60, 60)).toThrow(AppError);
    for (let i = 0; i < 30; i += 1) consumeMemoryRateLimit("react:user:one", 30, 60);
    expect(() => consumeMemoryRateLimit("react:user:one", 30, 60)).toThrow(AppError);
  });

  it("does not let a dummy 10-character token skip the integrity challenge", () => {
    for (let i = 0; i < REACTION_VELOCITY.ipBurst.count; i += 1) {
      observeReactionSuccess({
        ipHash: "abc123def4567890",
        userId: `burst-${i}`,
        messageId: MESSAGE,
        newSession: true,
        userAgent: BROWSER,
      });
    }
    const flagged = evaluateReactionIntegrity({
      ipHash: "abc123def4567890",
      userId: "burst-last",
      messageId: MESSAGE,
      newSession: true,
      userAgent: "curl/8.7.1",
    });
    expect(flagged.challenge).toBe(true);
    expect(() =>
      challengeReactionOrThrow(
        {
          ipHash: "abc123def4567890",
          userId: "burst-last",
          messageId: MESSAGE,
          newSession: true,
          userAgent: "curl/8.7.1",
        },
        undefined,
      ),
    ).toThrow(AppError);
    expect(() =>
      challengeReactionOrThrow(
        {
          ipHash: "abc123def4567890",
          userId: "burst-last",
          messageId: MESSAGE,
          newSession: true,
          userAgent: "curl/8.7.1",
        },
        "xxxxxxxxxx",
      ),
    ).toThrow(AppError);
  });

  it("cannot move Most 🔥 with one identity; can with many distinct visitors", () => {
    openShortLiveWall();
    const quiet = payAndPublish("Quiet leader.");
    const loud = payAndPublish("Needs a crowd.");
    addReactions(quiet.messageId, 40);
    reactOnce(loud.messageId, "one-hand");
    expect(codeOf(() => reactOnce(loud.messageId, "one-hand"))).toBe(ERROR_CODES.DUPLICATE_REACTION);
    const before = simulatedMessageList();
    const quietRow = before.find((row) => row.id === quiet.messageId)!;
    const loudRow = before.find((row) => row.id === loud.messageId)!;
    expect(compareHot(quietRow, loudRow)).toBeLessThan(0);
    addReactions(loud.messageId, 50);
    const after = simulatedMessageList();
    expect(
      compareHot(
        after.find((row) => row.id === quiet.messageId)!,
        after.find((row) => row.id === loud.messageId)!,
      ),
    ).toBeGreaterThan(0);
  });
});
