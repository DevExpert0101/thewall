import { describe, expect, it } from "vitest";
import { encodeEventTopics, toHex, type Hex } from "viem";
import { ERROR_CODES, AppError } from "@/lib/errors";
import { PRICE_USDC_ATOMIC } from "@/lib/constants";
import { parseUsdcAtomic, usdcAtomicEquals } from "@/lib/payment/amount-parse";
import { assertExactUsdcAmount } from "@/lib/payment/amount";
import { evaluatePaymentProof, normalizePaymentId } from "@/lib/payment/evaluate";
import {
  assertIntentFulfillable,
  bindMessageHash,
  type StoredIntent,
} from "@/lib/payment/fulfillment";
import { parseUsdcTransfersToTreasury } from "@/lib/payment/onchain";
import { verifyPaymentSchema } from "@/lib/validation";
import { mapPublishError } from "@/lib/data/rate-limit";
import type { OnchainPayment } from "@/lib/payment/types";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const TREASURY = "0x1111111111111111111111111111111111111111" as const;
const OTHER = "0x2222222222222222222222222222222222222222" as const;
const SENDER = "0x3333333333333333333333333333333333333333" as const;
const TX = `0x${"ab".repeat(32)}`;

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
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

function intent(overrides: Partial<StoredIntent> = {}): StoredIntent {
  const text = "I was here.";
  return {
    id: "11111111-1111-1111-1111-111111111111",
    anonymous_user_id: "22222222-2222-2222-2222-222222222222",
    status: "created",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    message_text: text,
    message_hash: bindMessageHash(text),
    amount: "1.00",
    currency: "USDC",
    network: "base-sepolia",
    recipient_wallet: TREASURY,
    ...overrides,
  };
}

describe("USDC amount", () => {
  it("parses 1.00 as exactly 1_000_000 atomic units", () => {
    expect(parseUsdcAtomic("1.00")).toBe(PRICE_USDC_ATOMIC);
    expect(parseUsdcAtomic("1")).toBe(PRICE_USDC_ATOMIC);
    expect(usdcAtomicEquals("1.0")).toBe(true);
  });

  it("rejects underpay, overpay, and malformed amounts", () => {
    expect(usdcAtomicEquals("0.999999")).toBe(false);
    expect(usdcAtomicEquals("1.000001")).toBe(false);
    expect(usdcAtomicEquals("2.00")).toBe(false);
    expect(parseUsdcAtomic("1.00.0")).toBeNull();
    expect(() => assertExactUsdcAmount(BigInt(999_999))).toThrow();
    expect(() => assertExactUsdcAmount(PRICE_USDC_ATOMIC)).not.toThrow();
  });
});

describe("client cannot prove payment", () => {
  it("rejects a payload with paymentSuccessful and no transaction hash", () => {
    const parsed = verifyPaymentSchema.safeParse({
      intentId: "11111111-1111-1111-1111-111111111111",
      paymentSuccessful: true,
    });
    expect(parsed.success).toBe(false);
  });

  it("ignores paymentSuccessful when a hash is present", () => {
    const parsed = verifyPaymentSchema.parse({
      intentId: "11111111-1111-1111-1111-111111111111",
      transactionHash: TX,
      paymentSuccessful: true,
    });
    expect(parsed).toEqual({
      intentId: "11111111-1111-1111-1111-111111111111",
      transactionHash: TX,
    });
    expect("paymentSuccessful" in parsed).toBe(false);
  });
});

describe("payment attack evaluation", () => {
  const base = {
    paymentId: TX,
    expectedAmount: "1.00",
    expectedRecipient: TREASURY,
    expectedNetwork: "base-sepolia" as const,
  };

  it("does not publish when the SDK says completed but the chain is still pending", () => {
    expectCode(
      () =>
        evaluatePaymentProof({
          ...base,
          sdk: { status: "completed", amount: "1.00", recipient: TREASURY, sender: SENDER },
          onchain: onchain({ found: false, pending: true, amountAtomic: null, sender: null, recipient: null }),
        }),
      ERROR_CODES.PAYMENT_PENDING,
    );
  });

  it("rejects a failed on-chain receipt", () => {
    expectCode(
      () =>
        evaluatePaymentProof({
          ...base,
          sdk: { status: "completed" },
          onchain: onchain({ receiptFailed: true, amountAtomic: null }),
        }),
      ERROR_CODES.PAYMENT_FAILED,
    );
  });

  it("rejects the wrong network", () => {
    expectCode(
      () =>
        evaluatePaymentProof({
          ...base,
          sdk: { status: "completed" },
          onchain: onchain({ chainId: 8453 }),
        }),
      ERROR_CODES.WRONG_NETWORK,
    );
  });

  it("rejects a payment to the wrong recipient", () => {
    expectCode(
      () =>
        evaluatePaymentProof({
          ...base,
          sdk: { status: "completed" },
          onchain: onchain({ recipient: OTHER }),
        }),
      ERROR_CODES.WRONG_RECIPIENT,
    );
  });

  it("rejects an underpayment even if the SDK reports 1.00", () => {
    expectCode(
      () =>
        evaluatePaymentProof({
          ...base,
          sdk: { status: "completed", amount: "1.00", recipient: TREASURY, sender: SENDER },
          onchain: onchain({ amountAtomic: BigInt(999_999) }),
        }),
      ERROR_CODES.WRONG_AMOUNT,
    );
  });

  it("rejects a missing sender", () => {
    expectCode(
      () =>
        evaluatePaymentProof({
          ...base,
          sdk: { status: "completed" },
          onchain: onchain({ sender: null }),
        }),
      ERROR_CODES.PAYMENT_INCOMPLETE,
    );
  });

  it("rejects a sender mismatch between SDK and chain", () => {
    expectCode(
      () =>
        evaluatePaymentProof({
          ...base,
          sdk: { status: "completed", sender: OTHER },
          onchain: onchain({ sender: SENDER }),
        }),
      ERROR_CODES.PAYMENT_INCOMPLETE,
    );
  });

  it("rejects a transaction mined before this checkout", () => {
    expectCode(
      () =>
        evaluatePaymentProof({
          ...base,
          intentCreatedAt: new Date().toISOString(),
          sdk: { status: "completed", sender: SENDER, recipient: TREASURY, amount: "1.00" },
          onchain: onchain({ minedAt: Math.floor(Date.now() / 1000) - 3600 }),
        }),
      ERROR_CODES.TX_ALREADY_USED,
    );
  });

  it("accepts only an exact 1.00 USDC transfer to the treasury on Base Sepolia", () => {
    const verified = evaluatePaymentProof({
      ...base,
      intentCreatedAt: new Date(Date.now() - 5_000).toISOString(),
      sdk: { status: "completed", sender: SENDER, recipient: TREASURY, amount: "1.00" },
      onchain: onchain(),
    });
    expect(verified.status).toBe("completed");
    expect(verified.amount).toBe("1.00");
    expect(verified.recipient).toBe(TREASURY.toLowerCase());
    expect(verified.sender).toBe(SENDER.toLowerCase());
    expect(verified.network).toBe("base-sepolia");
  });
});

describe("duplicate submissions and expiration", () => {
  const actor = "22222222-2222-2222-2222-222222222222";

  it("rejects a second fulfill of the same intent", () => {
    expectCode(
      () => assertIntentFulfillable(intent({ status: "fulfilled" }), actor),
      ERROR_CODES.INTENT_FULFILLED,
    );
  });

  it("rejects an expired intent", () => {
    expectCode(
      () =>
        assertIntentFulfillable(
          intent({ expires_at: new Date(Date.now() - 1000).toISOString() }),
          actor,
        ),
      ERROR_CODES.INTENT_EXPIRED,
    );
  });

  it("rejects a replay mapped from the database unique constraint", () => {
    expect(mapPublishError("tx_already_used").code).toBe(ERROR_CODES.TX_ALREADY_USED);
  });

  it("rejects a tampered message that no longer matches the bound hash", () => {
    expectCode(
      () => assertIntentFulfillable(intent({ message_text: "changed after checkout" }), actor),
      ERROR_CODES.HASH_MISMATCH,
    );
  });

  it("rejects a different anonymous user", () => {
    expectCode(
      () => assertIntentFulfillable(intent(), "33333333-3333-3333-3333-333333333333"),
      ERROR_CODES.FORBIDDEN,
    );
  });
});

describe("on-chain transfer parsing", () => {
  it("ignores transfers not to the treasury and non-USDC logs", () => {
    const transferTopic = encodeEventTopics({
      abi: [
        {
          type: "event",
          name: "Transfer",
          inputs: [
            { name: "from", type: "address", indexed: true },
            { name: "to", type: "address", indexed: true },
            { name: "value", type: "uint256", indexed: false },
          ],
        },
      ],
      eventName: "Transfer",
      args: { from: OTHER, to: OTHER },
    });
    const logs = [
      {
        address: USDC,
        topics: transferTopic as Hex[],
        data: toHex(BigInt(1_000_000), { size: 32 }),
      },
    ];
    expect(parseUsdcTransfersToTreasury(logs, USDC, TREASURY)).toHaveLength(0);
  });

  it("normalizes payment ids to lowercase hex", () => {
    expect(normalizePaymentId(TX.toUpperCase())).toBe(TX);
  });
});
