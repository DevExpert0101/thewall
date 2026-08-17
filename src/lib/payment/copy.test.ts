import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@/lib/errors";
import {
  PAY_CTA_DOLLARS,
  classifyCheckoutError,
  paymentLoadingLine,
  paymentStepTitle,
  visitorPaymentCopy,
} from "@/lib/payment/copy";

describe("visitor payment copy", () => {
  it("uses Pay $1 as the human checkout CTA", () => {
    expect(PAY_CTA_DOLLARS).toBe("Pay $1");
    expect(paymentStepTitle("confirm")).toMatch(/pay \$1/i);
  });

  it("classifies canceled, empty-balance, and failed checkouts", () => {
    expect(classifyCheckoutError(new Error("User rejected the request"))).toBe(
      ERROR_CODES.PAYMENT_CANCELED,
    );
    expect(classifyCheckoutError(new Error("insufficient funds"))).toBe(ERROR_CODES.INSUFFICIENT_USDC);
    expect(classifyCheckoutError(new Error("wrong network"))).toBe(ERROR_CODES.WRONG_NETWORK);
    expect(classifyCheckoutError(new Error("boom"))).toBe(ERROR_CODES.PAYMENT_FAILED);
  });

  it("tells the visitor whether money was taken", () => {
    expect(visitorPaymentCopy(ERROR_CODES.PAYMENT_CANCELED).money).toMatch(/no money was taken/i);
    expect(visitorPaymentCopy(ERROR_CODES.INSUFFICIENT_USDC).money).toMatch(/no money was taken/i);
    expect(visitorPaymentCopy(ERROR_CODES.PAYMENT_PENDING).money).toMatch(/do not pay again/i);
    expect(visitorPaymentCopy(ERROR_CODES.TX_ALREADY_USED).money).toMatch(/already published/i);
    expect(visitorPaymentCopy(ERROR_CODES.WRONG_NETWORK).recovery).toMatch(/do not send a second payment/i);
    expect(visitorPaymentCopy(ERROR_CODES.PAID_AFTER_CLOSE).recovery).toMatch(/not published/i);
    expect(visitorPaymentCopy(ERROR_CODES.PAID_AFTER_CLOSE).money).toMatch(/money was taken/i);
    expect(visitorPaymentCopy(ERROR_CODES.UNAVAILABLE).recovery).toMatch(/do not pay again/i);
  });

  it("explains loading without asking anyone to connect a wallet", () => {
    expect(paymentLoadingLine("paying", false)).toMatch(/approve \$1/i);
    expect(paymentLoadingLine("verifying", false)).toMatch(/do not pay again/i);
    expect(paymentLoadingLine("pending", false)).toMatch(/do not pay again/i);
    expect(paymentLoadingLine("creating", true)).toMatch(/no money is taken/i);
    expect(paymentLoadingLine("paying", false)?.toLowerCase()).not.toContain("connect wallet");
  });
});
