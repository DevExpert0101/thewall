import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PRICE_USDC_ATOMIC } from "@/lib/constants";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { evaluatePaymentProof } from "@/lib/payment/evaluate";
import { assertIntentFulfillable, bindMessageHash, type StoredIntent } from "@/lib/payment/fulfillment";
import { fulfillSimulatedPayment, simulatedMessageList } from "@/lib/data/simulation";
import {
  createUnpaidIntent,
  openShortLiveWall,
  payAndPublish,
  resetAutomatedWall,
} from "@/lib/testing/harness";
import type { OnchainPayment } from "@/lib/payment/types";

const TREASURY = "0x1111111111111111111111111111111111111111" as const;
const SENDER = "0x3333333333333333333333333333333333333333" as const;
const TX = `0x${"cd".repeat(32)}`;

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

describe("suite 22 — payment impersonation", () => {
  it("cannot publish Sentence B with the payment minted for Sentence A", () => {
    openShortLiveWall();
    const paid = payAndPublish("Sentence A stays bound.");
    const stolen = createUnpaidIntent("Sentence B must not publish.");
    expect(
      codeOf(() =>
        fulfillSimulatedPayment({
          intentId: stolen.checkout.intentId,
          userId: stolen.userId,
          paymentId: paid.paymentId,
        }),
      ),
    ).toBe(ERROR_CODES.PAYMENT_FAILED);
    expect(simulatedMessageList().some((row) => row.text === stolen.text)).toBe(false);
    expect(simulatedMessageList().filter((row) => row.text === paid.text)).toHaveLength(1);
  });

  it("cannot fulfill another visitor's checkout even with the minted payment id", () => {
    openShortLiveWall();
    const owner = createUnpaidIntent("Only the owner may finish this.");
    expect(
      codeOf(() =>
        fulfillSimulatedPayment({
          intentId: owner.checkout.intentId,
          userId: "local-sim-attacker",
          paymentId: owner.checkout.simulatedPaymentId,
        }),
      ),
    ).toBe(ERROR_CODES.FORBIDDEN);
    expect(simulatedMessageList().some((row) => row.text === owner.text)).toBe(false);
  });

  it("cannot attach a copied transaction that predates this checkout", () => {
    const createdAt = new Date().toISOString();
    expect(
      codeOf(() =>
        evaluatePaymentProof({
          paymentId: TX,
          expectedAmount: "1.00",
          expectedRecipient: TREASURY,
          expectedNetwork: "base-sepolia",
          intentCreatedAt: createdAt,
          sdk: { status: "completed", sender: SENDER, recipient: TREASURY, amount: "1.00" },
          onchain: onchain({ minedAt: Math.floor(Date.now() / 1000) - 3600 }),
        }),
      ),
    ).toBe(ERROR_CODES.TX_ALREADY_USED);
  });

  it("rejects a valid-looking transfer bound to a different actor's intent", () => {
    const intent: StoredIntent = {
      id: "11111111-1111-4111-8111-111111111111",
      anonymous_user_id: "22222222-2222-4222-8222-222222222222",
      status: "created",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      message_text: "Owner sentence.",
      message_hash: bindMessageHash("Owner sentence."),
      amount: "1.00",
      currency: "USDC",
      network: "base-sepolia",
      recipient_wallet: TREASURY,
    };
    expect(codeOf(() => assertIntentFulfillable(intent, "33333333-3333-4333-8333-333333333333"))).toBe(
      ERROR_CODES.FORBIDDEN,
    );
  });

  it("keeps live verify as intentId + client transaction hash (residual steal window)", () => {
    const verify = readFileSync(path.join(process.cwd(), "src/app/api/publish/verify/route.ts"), "utf8");
    const pay = readFileSync(path.join(process.cwd(), "src/lib/payment/browser.ts"), "utf8");
    expect(verify).toContain("body.transactionHash");
    expect(verify).toContain("body.intentId");
    expect(verify).toMatch(/assertIntentOwned/);
    expect(pay).toMatch(/pay\(\{[\s\S]*amount:[\s\S]*to:[\s\S]*testnet:/);
    expect(pay).not.toMatch(/intentId|idempotencyKey|metadata/);
  });
});
