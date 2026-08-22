import { afterEach, describe, expect, it } from "vitest";
import { ARCHIVAL_REMOVAL_TEXT } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { evaluateModeration } from "@/lib/moderation/rules";
import { preflightMessage } from "@/lib/publish/preflight";
import { canProceedToPayment } from "@/lib/moderation/types";
import { openShortLiveWall, payAndPublish, resetAutomatedWall } from "@/lib/testing/harness";
import { simulatedMessageList } from "@/lib/data/simulation";

afterEach(() => {
  resetAutomatedWall();
});

describe("suite 12 — moderation flow", () => {
  it("allows a clean sentence and blocks payment for synthetic rejects", async () => {
    expect(canProceedToPayment(evaluateModeration("I left one careful sentence."))).toBe(true);
    expect(evaluateModeration("spam spam spam spam spam spam spam spam").decision).toBe("rejected");
    expect(evaluateModeration("email me at visitor@example.com").decision).toBe("rejected");
    expect(evaluateModeration("I will kill you tonight").decision).toBe("rejected");
    expect(evaluateModeration("open file://secret.txt").decision).toBe("rejected");
    await expect(preflightMessage("spam spam spam spam spam spam spam spam")).rejects.toBeInstanceOf(AppError);
  });

  it("rejects a duplicate after a paid sentence and keeps the original number", async () => {
    openShortLiveWall();
    const first = payAndPublish("Unique enough for this Wall.");
    await expect(preflightMessage(first.text)).rejects.toBeInstanceOf(AppError);
    const removed = simulatedMessageList().find((row) => row.isRemoved);
    expect(removed?.text).toBe(ARCHIVAL_REMOVAL_TEXT);
    expect(removed?.publicNumber).toBeGreaterThan(0);
  });
});
