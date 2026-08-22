import { afterEach, describe, expect, it } from "vitest";
import { PRICE_USDC_ATOMIC } from "@/lib/constants";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { evaluatePaymentProof } from "@/lib/payment/evaluate";
import { fulfillSimulatedPayment } from "@/lib/data/simulation";
import {
  closeForReview,
  createUnpaidIntent,
  monumentCatalog,
  openShortLiveWall,
  payAndPublish,
  resetAutomatedWall,
  sealAutomatedWall,
} from "@/lib/testing/harness";

const TREASURY = "0x1111111111111111111111111111111111111111" as const;
const SENDER = "0x3333333333333333333333333333333333333333" as const;
const TX = `0x${"cd".repeat(32)}`;

afterEach(() => {
  resetAutomatedWall();
});

describe("suite 18 — chaos / fault injection", () => {
  it("does not publish on verifier timeout or failed receipt", () => {
    expect(() =>
      evaluatePaymentProof({
        paymentId: TX,
        expectedAmount: "1.00",
        expectedRecipient: TREASURY,
        expectedNetwork: "base-sepolia",
        intentCreatedAt: new Date().toISOString(),
        sdk: { status: "pending" },
        onchain: {
          found: false,
          pending: true,
          receiptFailed: false,
          chainId: 84532,
          sender: null,
          recipient: null,
          amountAtomic: null,
          minedAt: null,
        },
      }),
    ).toThrow(AppError);
    expect(() =>
      evaluatePaymentProof({
        paymentId: TX,
        expectedAmount: "1.00",
        expectedRecipient: TREASURY,
        expectedNetwork: "base-sepolia",
        intentCreatedAt: new Date().toISOString(),
        sdk: { status: "failed" },
        onchain: {
          found: true,
          pending: false,
          receiptFailed: true,
          chainId: 84532,
          sender: SENDER,
          recipient: TREASURY,
          amountAtomic: PRICE_USDC_ATOMIC,
          minedAt: Math.floor(Date.now() / 1000),
        },
      }),
    ).toThrow(AppError);
  });

  it("does not reopen or double-carve after a delayed duplicate response", () => {
    openShortLiveWall();
    const mark = payAndPublish("Chaos paid sentence.");
    const unpaid = createUnpaidIntent("Delayed after close.");
    const dup = fulfillSimulatedPayment({
      intentId: mark.intentId,
      userId: mark.userId,
      paymentId: mark.paymentId,
    });
    expect(dup.publicNumber).toBe(mark.publicNumber);
    closeForReview();
    expect(() =>
      fulfillSimulatedPayment({
        intentId: unpaid.checkout.intentId,
        userId: unpaid.userId,
        paymentId: unpaid.checkout.simulatedPaymentId,
      }),
    ).toThrow(AppError);
    sealAutomatedWall();
    sealAutomatedWall();
    expect(monumentCatalog()).toHaveLength(1);
  });
});
