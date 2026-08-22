import { afterEach, describe, expect, it } from "vitest";
import { fulfillSimulatedPayment } from "@/lib/data/simulation";
import { createUnpaidIntent, openShortLiveWall, payAndPublish, resetAutomatedWall } from "@/lib/testing/harness";

afterEach(() => {
  resetAutomatedWall();
  sessionStorage.clear();
});

describe("suite 19 — reload at critical points", () => {
  it("recovers a paid intent after the browser forgets the in-memory step", () => {
    openShortLiveWall();
    const unpaid = createUnpaidIntent("Reload after pay.");
    sessionStorage.setItem(
      "the-wall:checkout",
      JSON.stringify({
        intentId: unpaid.checkout.intentId,
        paymentId: unpaid.checkout.simulatedPaymentId,
        expiresAt: unpaid.checkout.expiresAt,
        text: unpaid.text,
        wallKey: unpaid.wallKey,
      }),
    );
    const first = fulfillSimulatedPayment({
      intentId: unpaid.checkout.intentId,
      userId: unpaid.userId,
      paymentId: unpaid.checkout.simulatedPaymentId,
    });
    const afterReload = fulfillSimulatedPayment({
      intentId: unpaid.checkout.intentId,
      userId: unpaid.userId,
      paymentId: unpaid.checkout.simulatedPaymentId,
    });
    expect(afterReload.publicNumber).toBe(first.publicNumber);
    expect(afterReload.recovered).toBe(true);
  });

  it("does not depend on compose draft memory to keep a published number", () => {
    openShortLiveWall();
    const mark = payAndPublish("Draft was lost.");
    sessionStorage.clear();
    const again = fulfillSimulatedPayment({
      intentId: mark.intentId,
      userId: mark.userId,
      paymentId: mark.paymentId,
    });
    expect(again.publicNumber).toBe(mark.publicNumber);
  });
});
