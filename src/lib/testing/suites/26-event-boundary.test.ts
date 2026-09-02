import { afterEach, describe, expect, it } from "vitest";
import { applyAdminEventControl } from "@/lib/admin/event-control";
import { createWallKey, hashWallKey } from "@/lib/crypto";
import { syncedNowMs } from "@/lib/event/clock";
import { phaseAfterClock } from "@/lib/event/remaining";
import { publishDecisionAfterPayment } from "@/lib/payment/close-policy";
import {
  assertPublishOpen,
  assertReactOpen,
  publicMessageForPhase,
  reconcilePublicPhase,
} from "@/lib/event/state";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { PublicMessage } from "@/lib/types";
import { composeSchema, verifyPaymentSchema } from "@/lib/validation";
import {
  addSimulatedReaction,
  createSimulatedIntent,
  currentSimulatedEvent,
  expireSimulatedWall,
  fulfillSimulatedPayment,
} from "@/lib/data/simulation";
import {
  addReactions,
  closeForReview,
  createUnpaidIntent,
  discloseResults,
  monumentCatalog,
  openShortLiveWall,
  openUpcomingWall,
  payAndPublish,
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

const OFFSETS = [
  ["T-10m", -10 * 60_000, "open"],
  ["T-1m", -60_000, "open"],
  ["T-10s", -10_000, "open"],
  ["T-1s", -1_000, "open"],
  ["T-1ms", -1, "open"],
  ["T", 0, "closed"],
  ["T+1ms", 1, "closed"],
  ["T+1s", 1_000, "closed"],
  ["T+10s", 10_000, "closed"],
  ["T+1m", 60_000, "closed"],
] as const;

describe("suite 26 — 24-hour event boundary", () => {
  it("opens only at starts_at and treats every listed offset against ends_at as server time", () => {
    const startsAt = "2026-08-16T00:00:00.000Z";
    const endsAt = "2026-08-17T00:00:00.000Z";
    const event = { phase: "live" as const, endsAt };

    expect(codeOf(() => assertPublishOpen({ phase: "upcoming", endsAt }, undefined, new Date(startsAt)))).toBe(
      ERROR_CODES.EVENT_UPCOMING,
    );
    expect(() => assertPublishOpen({ phase: "live", endsAt }, undefined, new Date(startsAt))).not.toThrow();

    for (const [label, delta, gate] of OFFSETS) {
      const now = new Date(Date.parse(endsAt) + delta);
      if (gate === "open") {
        expect(() => assertPublishOpen(event, undefined, now), label).not.toThrow();
        expect(() => assertReactOpen(event, undefined, now), label).not.toThrow();
        expect(publishDecisionAfterPayment("live", { endsAt, now })).toBe("publish");
      } else {
        expect(codeOf(() => assertPublishOpen(event, undefined, now)), label).toBe(ERROR_CODES.EVENT_ENDED);
        expect(codeOf(() => assertReactOpen(event, undefined, now)), label).toBe(ERROR_CODES.EVENT_ENDED);
        expect(publishDecisionAfterPayment("live", { endsAt, now })).toBe("paid_after_close");
      }
    }
  });

  it("does not move the deadline when the device clock or timezone label changes", () => {
    const endsAt = "2026-08-17T00:00:00.000Z";
    const event = { phase: "live" as const, endsAt };
    const tokyoLabel = new Date("2026-08-17T09:00:00+09:00");
    expect(tokyoLabel.getTime()).toBe(Date.parse(endsAt));
    expect(codeOf(() => assertPublishOpen(event, undefined, tokyoLabel))).toBe(ERROR_CODES.EVENT_ENDED);

    const serverNow = "2026-08-16T23:59:50.000Z";
    const origin = 5_000_000;
    const afterSleep = origin + 8 * 60 * 60_000;
    expect(syncedNowMs(serverNow, origin, afterSleep)).toBe(Date.parse("2026-08-17T07:59:50.000Z"));
    expect(codeOf(() => assertPublishOpen(event, undefined, new Date(syncedNowMs(serverNow, origin, afterSleep))))).toBe(
      ERROR_CODES.EVENT_ENDED,
    );

    const remountOrigin = 9_000_000;
    expect(syncedNowMs(serverNow, remountOrigin, remountOrigin)).toBe(Date.parse(serverNow));
  });

  it("rejects checkout, fulfill, and 🔥 after ends_at; accepts them 1ms before", () => {
    openShortLiveWall(5);
    const mark = payAndPublish("Boundary leader.");
    addReactions(mark.messageId, 3);
    const endsAt = currentSimulatedEvent().endsAt;
    const tMinus = new Date(Date.parse(endsAt) - 1);
    const tPlus = new Date(Date.parse(endsAt) + 1);

    const lateCheckout = createUnpaidIntent("In flight.", "flyer", tMinus);
    expect(
      codeOf(() =>
        createSimulatedIntent({
          text: "Start payment after close.",
          userId: "late-intent",
          claimSecretHash: hashWallKey(createWallKey()),
          now: tPlus,
        }),
      ),
    ).toBe(ERROR_CODES.EVENT_ENDED);

    expect(
      codeOf(() =>
        fulfillSimulatedPayment({
          intentId: lateCheckout.checkout.intentId,
          userId: lateCheckout.userId,
          paymentId: lateCheckout.checkout.simulatedPaymentId,
          now: tPlus,
        }),
      ),
    ).toBe(ERROR_CODES.PAID_AFTER_CLOSE);

    expect(() => addSimulatedReaction(mark.messageId, "before-bell", undefined, tMinus)).not.toThrow();
    expect(codeOf(() => addSimulatedReaction(mark.messageId, "after-bell", undefined, tPlus))).toBe(
      ERROR_CODES.EVENT_ENDED,
    );
  });

  it("does not honor client now/endsAt on publish verify bodies", () => {
    expect(Object.keys(composeSchema.shape)).toEqual(["message", "turnstileToken"]);
    const parsed = verifyPaymentSchema.parse({
      intentId: "11111111-1111-4111-8111-111111111111",
      transactionHash: `0x${"ab".repeat(32)}`,
      now: "2099-01-01T00:00:00.000Z",
      endsAt: "2099-01-01T00:00:00.000Z",
      phase: "live",
    });
    expect(parsed).toEqual({
      intentId: "11111111-1111-4111-8111-111111111111",
      transactionHash: `0x${"ab".repeat(32)}`,
    });
  });

  it("accepts a burst 1ms before the bell and rejects the same burst on the bell", async () => {
    openShortLiveWall(5);
    const endsAt = currentSimulatedEvent().endsAt;
    const justBefore = new Date(Date.parse(endsAt) - 1);
    const onBell = new Date(Date.parse(endsAt));
    const before = await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        Promise.resolve().then(() =>
          createSimulatedIntent({
            text: `Burst ${n}.`,
            userId: `burst-${n}`,
            claimSecretHash: hashWallKey(createWallKey()),
            now: justBefore,
          }),
        ),
      ),
    );
    expect(before).toHaveLength(5);
    const after = await Promise.allSettled(
      [1, 2, 3, 4, 5].map((n) =>
        Promise.resolve().then(() =>
          createSimulatedIntent({
            text: `Late burst ${n}.`,
            userId: `late-burst-${n}`,
            claimSecretHash: hashWallKey(createWallKey()),
            now: onBell,
          }),
        ),
      ),
    );
    expect(after.every((row) => row.status === "rejected")).toBe(true);
  });

  it("stays closed after expiry, second Finish, and a stale live pulse", async () => {
    openShortLiveWall();
    const winner = payAndPublish("Freeze the ranks.");
    addReactions(winner.messageId, 40);
    expect(closeForReview().phase).toBe("finalizing");
    expect(currentSimulatedEvent().phase).toBe("finalizing");
    expect(
      phaseAfterClock("live", currentSimulatedEvent().startsAt, currentSimulatedEvent().endsAt, Date.now()).phase,
    ).toBe("finalizing");
    expect(
      reconcilePublicPhase({
        reported: "live",
        previous: "finalizing",
        endsAt: currentSimulatedEvent().endsAt,
        now: Date.now(),
      }),
    ).toBe("finalizing");

    const again = closeForReview();
    expect(again.phase).toBe("finalizing");

    const sealed = await discloseResults();
    expect(sealed.phase).toBe("archived");
    const rank = monumentCatalog()[0];
    await expect(discloseResults()).rejects.toBeInstanceOf(AppError);
    expect(currentSimulatedEvent().phase).toBe("archived");
    expect(monumentCatalog()[0]?.text).toBe(rank?.text);
    expect(monumentCatalog()[0]?.position).toBe(rank?.position);

    const message: PublicMessage = {
      id: winner.messageId,
      eventId: "local",
      publicNumber: winner.publicNumber,
      text: winner.text,
      isRemoved: false,
      reactionCount: 40,
      publishedAt: "2026-08-16T12:00:00.000Z",
      finalRank: 1,
    };
    expect(publicMessageForPhase(message, "finalizing").finalRank).toBeNull();
    expect(publicMessageForPhase(message, "archived").finalRank).toBe(1);
  });

  it("does not treat an upcoming wall as writable and does not reopen from clock skew after seal", () => {
    const upcoming = openUpcomingWall();
    expect(upcoming.phase).toBe("upcoming");
    expect(
      codeOf(() =>
        createSimulatedIntent({
          text: "Too early.",
          userId: "early",
          claimSecretHash: hashWallKey(createWallKey()),
        }),
      ),
    ).toBe(ERROR_CODES.EVENT_UPCOMING);

    openShortLiveWall();
    payAndPublish("Sealed day.");
    sealAutomatedWall();
    expect(currentSimulatedEvent().phase).toBe("archived");
    expect(
      reconcilePublicPhase({
        reported: "live",
        previous: "archived",
        endsAt: currentSimulatedEvent().endsAt,
        now: Date.now() - 86_400_000,
      }),
    ).toBe("archived");
  });

  it("refuses admin clock reopen and a second start while under review", async () => {
    openShortLiveWall();
    payAndPublish("Review lock.");
    expect(closeForReview().phase).toBe("finalizing");
    await expect(
      applyAdminEventControl({
        action: "save",
        remainingMinutes: 30,
        confirmHistoricalEdit: true,
        confirmText: "CLOCK",
      }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(applyAdminEventControl({ action: "start", title: "REOPEN" })).rejects.toBeInstanceOf(AppError);
    expect(currentSimulatedEvent().phase).toBe("finalizing");
    expect(
      codeOf(() =>
        createSimulatedIntent({
          text: "Admin reopen write.",
          userId: "reopen",
          claimSecretHash: hashWallKey(createWallKey()),
        }),
      ),
    ).toBe(ERROR_CODES.EVENT_ENDED);
  });

  it("keeps writes closed after a second expire and after handler restart", () => {
    openShortLiveWall();
    const mark = payAndPublish("Restart around close.");
    const first = expireSimulatedWall();
    expect(first.phase).toBe("finalizing");
    const second = expireSimulatedWall();
    expect(second.phase).toBe("finalizing");
    expect(
      codeOf(() =>
        createSimulatedIntent({
          text: "After second expire.",
          userId: "second-expire",
          claimSecretHash: hashWallKey(createWallKey()),
        }),
      ),
    ).toBe(ERROR_CODES.EVENT_ENDED);
    expect(codeOf(() => addSimulatedReaction(mark.messageId, "after-restart"))).toBe(ERROR_CODES.EVENT_ENDED);
    expect(currentSimulatedEvent().phase).toBe("finalizing");
  });

  it("does not reopen writes if the server clock steps backward after expire", () => {
    openShortLiveWall();
    const closedAt = expireSimulatedWall().endsAt;
    const rolledBack = new Date(Date.parse(closedAt) - 1);
    expect(
      codeOf(() =>
        createSimulatedIntent({
          text: "Clock rollback write.",
          userId: "rollback",
          claimSecretHash: hashWallKey(createWallKey()),
          now: rolledBack,
        }),
      ),
    ).toBe(ERROR_CODES.EVENT_ENDED);
    expect(currentSimulatedEvent(rolledBack).phase).not.toBe("live");
  });

  it("does not reopen if expire is invoked with a later clock", () => {
    openShortLiveWall();
    const first = expireSimulatedWall();
    expireSimulatedWall(new Date(Date.parse(first.endsAt) + 10_000));
    const duringGap = new Date(Date.parse(first.endsAt) + 1_000);
    expect(currentSimulatedEvent(duringGap).phase).not.toBe("live");
    expect(
      codeOf(() =>
        createSimulatedIntent({
          text: "Reopened by second expire.",
          userId: "future-expire",
          claimSecretHash: hashWallKey(createWallKey()),
          now: duringGap,
        }),
      ),
    ).toBe(ERROR_CODES.EVENT_ENDED);
  });
});
