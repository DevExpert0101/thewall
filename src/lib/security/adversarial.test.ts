import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ERROR_CODES, AppError } from "@/lib/errors";
import { PRICE_USDC_ATOMIC } from "@/lib/constants";
import { evaluatePaymentProof } from "@/lib/payment/evaluate";
import {
  assertIntentFulfillable,
  assertMessageBound,
  bindMessageHash,
  type StoredIntent,
} from "@/lib/payment/fulfillment";
import { verifyPaymentSchema, certificateQuerySchema } from "@/lib/validation";
import { mapPublishError } from "@/lib/data/rate-limit";
import { canProceedToPayment } from "@/lib/moderation/types";
import { RuleBasedModerationProvider } from "@/lib/moderation/rules";
import { preflightMessage } from "@/lib/publish/preflight";
import { assertHistoricalTimestampEdit } from "@/lib/event/admin-edit";
import { assertEventLive } from "@/lib/event/state";
import { ABUSE_LIMITS, rateLimitKey } from "@/lib/abuse/keys";
import { hashToken, tokensEqual } from "@/lib/crypto";
import { getPublicEnv } from "@/lib/env";
import { serializeJsonLd } from "@/lib/security/csp";
import type { OnchainPayment } from "@/lib/payment/types";

const TREASURY = "0x1111111111111111111111111111111111111111" as const;
const OTHER = "0x2222222222222222222222222222222222222222" as const;
const SENDER = "0x3333333333333333333333333333333333333333" as const;
const TX = `0x${"ab".repeat(32)}`;
const ACTOR = "22222222-2222-2222-2222-222222222222";

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
    anonymous_user_id: ACTOR,
    status: "created",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    created_at: new Date(Date.now() - 5_000).toISOString(),
    message_text: text,
    message_hash: bindMessageHash(text),
    amount: "1.00",
    currency: "USDC",
    network: "base-sepolia",
    recipient_wallet: TREASURY,
    ...overrides,
  };
}

const proofBase = {
  paymentId: TX,
  expectedAmount: "1.00",
  expectedRecipient: TREASURY,
  expectedNetwork: "base-sepolia" as const,
  intentCreatedAt: new Date(Date.now() - 5_000).toISOString(),
};

describe("1 publish without paying", () => {
  it("strips client paymentSuccessful and still requires a transaction hash", () => {
    expect(
      verifyPaymentSchema.safeParse({
        intentId: "11111111-1111-1111-1111-111111111111",
        paymentSuccessful: true,
      }).success,
    ).toBe(false);
  });

  it("does not treat an SDK completed flag as on-chain proof", () => {
    expectCode(
      () =>
        evaluatePaymentProof({
          ...proofBase,
          sdk: { status: "completed", sender: SENDER, recipient: TREASURY, amount: "1.00" },
          onchain: onchain({
            found: false,
            pending: true,
            amountAtomic: null,
            sender: null,
            recipient: null,
            minedAt: null,
          }),
        }),
      ERROR_CODES.PAYMENT_PENDING,
    );
  });
});

describe("2 reuse another person's transaction", () => {
  it("rejects an intent that belongs to a different anonymous session", () => {
    expectCode(
      () => assertIntentFulfillable(intent(), "33333333-3333-3333-3333-333333333333"),
      ERROR_CODES.FORBIDDEN,
    );
  });

  it("maps a colliding transaction hash from the database", () => {
    expect(mapPublishError("tx_already_used").code).toBe(ERROR_CODES.TX_ALREADY_USED);
  });
});

describe("3 reuse their own transaction", () => {
  it("rejects a second fulfill of the same intent", () => {
    expectCode(
      () => assertIntentFulfillable(intent({ status: "fulfilled" }), ACTOR),
      ERROR_CODES.INTENT_FULFILLED,
    );
  });

  it("rejects a transfer mined before this checkout", () => {
    expectCode(
      () =>
        evaluatePaymentProof({
          ...proofBase,
          intentCreatedAt: new Date().toISOString(),
          sdk: { status: "completed", sender: SENDER, recipient: TREASURY, amount: "1.00" },
          onchain: onchain({ minedAt: Math.floor(Date.now() / 1000) - 3600 }),
        }),
      ERROR_CODES.TX_ALREADY_USED,
    );
  });
});

describe("4 manipulate amount", () => {
  it("rejects an underpayment even if the SDK reports 1.00", () => {
    expectCode(
      () =>
        evaluatePaymentProof({
          ...proofBase,
          sdk: { status: "completed", amount: "1.00", recipient: TREASURY, sender: SENDER },
          onchain: onchain({ amountAtomic: BigInt(999_999) }),
        }),
      ERROR_CODES.WRONG_AMOUNT,
    );
  });
});

describe("5 manipulate recipient", () => {
  it("rejects a payment sent to a different address", () => {
    expectCode(
      () =>
        evaluatePaymentProof({
          ...proofBase,
          sdk: { status: "completed" },
          onchain: onchain({ recipient: OTHER }),
        }),
      ERROR_CODES.WRONG_RECIPIENT,
    );
  });
});

describe("6 modify message after payment", () => {
  it("rejects text that no longer matches the bound checkout hash", () => {
    expectCode(
      () => assertMessageBound("changed after checkout", bindMessageHash("I was here.")),
      ERROR_CODES.HASH_MISMATCH,
    );
    expectCode(
      () => assertIntentFulfillable(intent({ message_text: "changed after checkout" }), ACTOR),
      ERROR_CODES.HASH_MISMATCH,
    );
  });

  it("maps frozen intent terms as a hash mismatch", () => {
    expect(mapPublishError("intent_terms_frozen").code).toBe(ERROR_CODES.HASH_MISMATCH);
  });
});

describe("7 react repeatedly", () => {
  it("maps a unique-constraint duplicate reaction", () => {
    expect(mapPublishError("duplicate_reaction").code).toBe(ERROR_CODES.DUPLICATE_REACTION);
  });
});

describe("8 create thousands of anonymous accounts", () => {
  it("always has an IP rate-limit bucket, including missing addresses", () => {
    expect(ABUSE_LIMITS.session.ip[0]).toBeLessThanOrEqual(20);
    expect(rateLimitKey("session", "ip", "abc").startsWith("session:ip:")).toBe(true);
  });
});

describe("9 inject HTML/scripts", () => {
  it("escapes script breakouts before JSON-LD is inlined", () => {
    const html = serializeJsonLd({ description: "</script><script>alert(1)</script>" });
    expect(html).not.toContain("</script>");
  });
});

describe("10 enumerate certificate tokens", () => {
  it("accepts only 64 hex characters", () => {
    expect(certificateQuerySchema.safeParse({ token: "abc" }).success).toBe(false);
    expect(certificateQuerySchema.safeParse({ token: "g".repeat(64) }).success).toBe(false);
    expect(certificateQuerySchema.safeParse({ token: "a".repeat(64) }).success).toBe(true);
    expect(certificateQuerySchema.safeParse({ token: "a".repeat(65) }).success).toBe(false);
    expect(certificateQuerySchema.safeParse({ token: "7K9P-X4MF-82QH-K3R2" }).success).toBe(true);
  });

  it("compares missing certificates with a dummy hash", () => {
    const missing = hashToken("the-wall-missing-certificate-placeholder");
    const probe = hashToken("b".repeat(64));
    expect(tokensEqual(missing, probe)).toBe(false);
    expect(ABUSE_LIMITS.certificate.ip[0]).toBe(30);
  });
});

describe("11 access service-role endpoints", () => {
  it("does not expose the service-role key on the public env object", () => {
    const env = getPublicEnv();
    expect(env).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
    expect(JSON.stringify(env)).not.toContain("SERVICE_ROLE");
  });

  it("keeps the privileged client behind server-only", () => {
    const src = readFileSync("src/lib/supabase/admin.ts", "utf8");
    expect(src.startsWith('import "server-only"')).toBe(true);
  });

  it("does not import the service-role client from browser modules", () => {
    const clients = [
      "src/lib/supabase/browser.ts",
      "src/lib/payment/browser.ts",
      "src/components/admin/dashboard.tsx",
      "src/components/message-card.tsx",
      "src/components/wall-live.tsx",
    ];
    for (const file of clients) {
      const src = readFileSync(file, "utf8");
      expect(src).not.toMatch(/createServiceSupabase|SUPABASE_SERVICE_ROLE_KEY/);
    }
  });
});

describe("12 alter event timing", () => {
  it("rejects post-launch timestamp changes without confirmation", () => {
    expect(() =>
      assertHistoricalTimestampEdit({
        launched: true,
        changingWindow: true,
        confirmed: false,
      }),
    ).toThrow(AppError);
  });
});

describe("13 bypass moderation", () => {
  it("refuses rejected copy before payment", async () => {
    const provider = new RuleBasedModerationProvider();
    const result = await provider.review({ text: "a".repeat(50) });
    expect(canProceedToPayment(result)).toBe(false);
    await expect(preflightMessage("a".repeat(50))).rejects.toMatchObject({
      code: ERROR_CODES.MODERATION_REJECTED,
    });
  });
});

describe("14 call APIs after event close", () => {
  it("rejects writes once the wall is no longer live", () => {
    expectCode(() => assertEventLive("finalizing"), ERROR_CODES.EVENT_ENDED);
    expectCode(() => assertEventLive("archived"), ERROR_CODES.EVENT_ENDED);
    expect(mapPublishError("event_ended").code).toBe(ERROR_CODES.EVENT_ENDED);
  });
});
