import { afterEach, describe, expect, it } from "vitest";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { addSimulatedReaction, simulatedMessageList } from "@/lib/data/simulation";
import {
  closeForReview,
  openShortLiveWall,
  payAndPublish,
  reactOnce,
  resetAutomatedWall,
  sealAutomatedWall,
} from "@/lib/testing/harness";

afterEach(() => {
  resetAutomatedWall();
});

describe("suite 5 — reaction abuse", () => {
  it("keeps one 🔥 per identity across click, replay, tabs, and parallel calls", async () => {
    openShortLiveWall();
    const mark = payAndPublish("Abuse target.");
    const identity = "same-session";
    const parallel = await Promise.allSettled(
      Array.from({ length: 25 }, async () => addSimulatedReaction(mark.messageId, identity)),
    );
    const ok = parallel.filter((row) => row.status === "fulfilled");
    const denied = parallel.filter((row) => row.status === "rejected");
    expect(ok.length).toBe(1);
    expect(denied.length).toBe(24);
    const after = simulatedMessageList().find((row) => row.id === mark.messageId);
    expect(after?.reactionCount).toBe(1);
    const replay = addSimulatedReaction(mark.messageId, "replay-user", "same-key");
    expect(addSimulatedReaction(mark.messageId, "replay-user", "same-key")).toBe(replay);
    expect(simulatedMessageList().find((row) => row.id === mark.messageId)?.reactionCount).toBe(2);
  });

  it("rejects malformed, missing, removed, closed, and archived targets", () => {
    openShortLiveWall();
    const live = payAndPublish("Still standing.");
    expect(() => reactOnce("not-a-message", "x")).toThrow(AppError);
    expect(() => reactOnce("00000000-0000-4000-8000-000000009999", "x")).toThrow(AppError);
    const removed = simulatedMessageList().find((row) => row.isRemoved);
    if (removed) {
      try {
        reactOnce(removed.id, "on-removed");
        throw new Error("reacted to a removed sentence");
      } catch (error) {
        expect((error as AppError).code).toBe(ERROR_CODES.MESSAGE_NOT_FOUND);
      }
    }
    closeForReview();
    expect(() => reactOnce(live.messageId, "after-ends")).toThrow(AppError);
    resetAutomatedWall();
    openShortLiveWall();
    const next = payAndPublish("About to seal.");
    sealAutomatedWall();
    expect(() => reactOnce(next.messageId, "after-seal")).toThrow(AppError);
  });
});
