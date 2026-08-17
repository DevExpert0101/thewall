import { describe, expect, it } from "vitest";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { decideVerifiedPayment, paidAfterCloseError } from "@/lib/payment/recover";

describe("verified payment recovery", () => {
  it("publishes only while live and names the close race", () => {
    expect(decideVerifiedPayment("live")).toBe("publish");
    expect(paidAfterCloseError().code).toBe(ERROR_CODES.PAID_AFTER_CLOSE);
    try {
      decideVerifiedPayment("finalizing");
      throw new Error("expected paid-after-close");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ERROR_CODES.PAID_AFTER_CLOSE);
    }
  });
});
