import { afterEach, describe, expect, it } from "vitest";
import { PRICE_USDC_ATOMIC } from "@/lib/constants";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { evaluatePaymentProof } from "@/lib/payment/evaluate";
import {
  assertIntentFulfillable,
  assertMessageBound,
  bindMessageHash,
  type StoredIntent,
} from "@/lib/payment/fulfillment";
import { fulfillSimulatedPayment, simulatedMessageList } from "@/lib/data/simulation";
import { createUnpaidIntent, openShortLiveWall, payAndPublish, resetAutomatedWall } from "@/lib/testing/harness";
import type { OnchainPayment } from "@/lib/payment/types";

const TREASURY = "0x1111111111111111111111111111111111111111" as const;
const OTHER = "0x2222222222222222222222222222222222222222" as const;
const SENDER = "0x3333333333333333333333333333333333333333" as const;
const TX = `0x${"ab".repeat(32)}`;

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

function onchain(partial: Partial<OnchainPayment> = {}): OnchainPayment {
  return {
    found: true,
    pending: false,
    receiptFailed: false,
    chainId: 84532,
    sender: SENDER,
    recipient: TREASURY,
    amountAtomic: PRICE_USDC_ATOMIC,
    minedAt: Math.floor(Date.now() / 1000),
    ...partial,
  };
}

describe("suite 3 — payment failures", () => {
  it("publishes exactly once for a valid payment, double click, refresh, and crash replay", () => {
    openShortLiveWall();
    const mark = payAndPublish("Exactly one paid sentence.");
    const replay = [1, 2, 3].map(() =>
      fulfillSimulatedPayment({
        intentId: mark.intentId,
        userId: mark.userId,
        paymentId: mark.paymentId,
      }),
    );
    expect(new Set(replay.map((row) => row.publicNumber))).toEqual(new Set([mark.publicNumber]));
    expect(simulatedMessageList().filter((row) => row.text === mark.text)).toHaveLength(1);
  });

  it("rejects wrong amount, recipient, failed tx, expired intent, and altered sentence", () => {
    const proof = {
      paymentId: TX,
      expectedAmount: "1.00",
      expectedRecipient: TREASURY,
      expectedNetwork: "base-sepolia" as const,
      intentCreatedAt: new Date(Date.now() - 1000).toISOString(),
    };
    expect(
      codeOf(() =>
        evaluatePaymentProof({
          ...proof,
          sdk: { status: "completed" },
          onchain: onchain({ amountAtomic: BigInt(500_000) }),
        }),
      ),
    ).toBe(ERROR_CODES.WRONG_AMOUNT);
    expect(
      codeOf(() =>
        evaluatePaymentProof({
          ...proof,
          sdk: { status: "completed" },
          onchain: onchain({ recipient: OTHER }),
        }),
      ),
    ).toBe(ERROR_CODES.WRONG_RECIPIENT);
    expect(
      codeOf(() =>
        evaluatePaymentProof({
          ...proof,
          sdk: { status: "failed" },
          onchain: onchain({ receiptFailed: true, amountAtomic: null }),
        }),
      ),
    ).toBe(ERROR_CODES.PAYMENT_FAILED);

    const intent: StoredIntent = {
      id: "11111111-1111-1111-1111-111111111111",
      anonymous_user_id: "22222222-2222-2222-2222-222222222222",
      status: "created",
      expires_at: new Date(Date.now() - 1000).toISOString(),
      message_text: "Sentence A",
      message_hash: bindMessageHash("Sentence A"),
      amount: "1.00",
      currency: "USDC",
      network: "base-sepolia",
      recipient_wallet: TREASURY,
    };
    expect(codeOf(() => assertIntentFulfillable(intent, intent.anonymous_user_id))).toBe(
      ERROR_CODES.INTENT_EXPIRED,
    );
    expect(codeOf(() => assertMessageBound("Sentence B", intent.message_hash))).toBe(
      ERROR_CODES.HASH_MISMATCH,
    );
  });

  it("rejects a second use of the same transaction after one publish", async () => {
    openShortLiveWall();
    const first = payAndPublish("Bound to this payment.");
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        Promise.resolve(
          fulfillSimulatedPayment({
            intentId: first.intentId,
            userId: first.userId,
            paymentId: first.paymentId,
          }),
        ),
      ),
    );
    expect(results.every((row) => row.publicNumber === first.publicNumber)).toBe(true);
    expect(simulatedMessageList().filter((row) => row.text === first.text)).toHaveLength(1);
  });

  it("cannot fulfill with a different payment id than checkout minted", () => {
    openShortLiveWall();
    const unpaid = createUnpaidIntent("Checkout sentence.");
    expect(
      codeOf(() =>
        fulfillSimulatedPayment({
          intentId: unpaid.checkout.intentId,
          userId: unpaid.userId,
          paymentId: `0x${"11".repeat(32)}`,
        }),
      ),
    ).toBe(ERROR_CODES.PAYMENT_FAILED);
  });

  it("does not publish when the intent expires before verify", () => {
    openShortLiveWall(60);
    const unpaid = createUnpaidIntent("Expires before verify.");
    const late = new Date(Date.parse(unpaid.checkout.expiresAt) + 1000);
    expect(
      codeOf(() =>
        fulfillSimulatedPayment({
          intentId: unpaid.checkout.intentId,
          userId: unpaid.userId,
          paymentId: unpaid.checkout.simulatedPaymentId,
          now: late,
        }),
      ),
    ).toBe(ERROR_CODES.INTENT_EXPIRED);
    expect(simulatedMessageList().some((row) => row.text === unpaid.text)).toBe(false);
  });
});
