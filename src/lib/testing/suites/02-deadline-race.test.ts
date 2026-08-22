import { afterEach, describe, expect, it } from "vitest";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { assertPublishOpen, assertReactOpen, assertWritesOpen } from "@/lib/event/state";
import { createWallKey, hashWallKey } from "@/lib/crypto";
import {
  addSimulatedReaction,
  createSimulatedIntent,
  currentSimulatedEvent,
  fulfillSimulatedPayment,
} from "@/lib/data/simulation";
import {
  closeForReview,
  createUnpaidIntent,
  openShortLiveWall,
  payAndPublish,
  resetAutomatedWall,
} from "@/lib/testing/harness";

afterEach(() => {
  resetAutomatedWall();
});

function expectEnded(fn: () => unknown) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ERROR_CODES.EVENT_ENDED);
    return;
  }
  throw new Error("expected EVENT_ENDED");
}

describe("suite 2 — deadline race conditions", () => {
  it("uses server ends_at, not a stale or skewed client clock", () => {
    const endsAt = "2026-08-19T12:00:00.000Z";
    const event = { phase: "live" as const, endsAt };
    const offsets = [
      ["T-5s", -5000, true],
      ["T-1s", -1000, true],
      ["T-100ms", -100, true],
      ["T", 0, false],
      ["T+100ms", 100, false],
      ["T+1s", 1000, false],
    ] as const;

    for (const [, delta, accept] of offsets) {
      const now = new Date(Date.parse(endsAt) + delta);
      if (accept) {
        expect(() => assertWritesOpen(event, now)).not.toThrow();
        expect(() => assertPublishOpen(event, undefined, now)).not.toThrow();
        expect(() => assertReactOpen(event, undefined, now)).not.toThrow();
      } else {
        expectEnded(() => assertWritesOpen(event, now));
        expectEnded(() => assertPublishOpen(event, undefined, now));
        expectEnded(() => assertReactOpen(event, undefined, now));
      }
    }
  });

  it("rejects a delayed publish/react after the authoritative close", () => {
    openShortLiveWall(5);
    const mark = payAndPublish("Deadline race sentence.");
    const checkout = createUnpaidIntent("Still in flight before close.");
    closeForReview();
    try {
      fulfillSimulatedPayment({
        intentId: checkout.checkout.intentId,
        userId: checkout.userId,
        paymentId: checkout.checkout.simulatedPaymentId,
      });
      throw new Error("expected late fulfill to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ERROR_CODES.PAID_AFTER_CLOSE);
    }
    expectEnded(() => addSimulatedReaction(mark.messageId, "after-close"));
    expectEnded(() =>
      createSimulatedIntent({
        text: "Retry after closure.",
        userId: "retry",
        claimSecretHash: hashWallKey(createWallKey()),
      }),
    );
    expect(currentSimulatedEvent().phase).toBe("finalizing");
  });

  it("accepts simultaneous writes only while now is before ends_at", () => {
    openShortLiveWall(5);
    const endsAt = currentSimulatedEvent().endsAt;
    const justBefore = new Date(Date.parse(endsAt) - 1);
    const atClose = new Date(Date.parse(endsAt));
    const accepted = [1, 2, 3].map((n) =>
      createSimulatedIntent({
        text: `Beat the bell ${n}.`,
        userId: `before-${n}`,
        claimSecretHash: hashWallKey(createWallKey()),
        now: justBefore,
      }),
    );
    expect(accepted).toHaveLength(3);
    expectEnded(() =>
      createSimulatedIntent({
        text: "Arrives on the bell.",
        userId: "on-bell",
        claimSecretHash: hashWallKey(createWallKey()),
        now: atClose,
      }),
    );
  });
});
