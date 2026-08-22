import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ERROR_CODES } from "@/lib/errors";
import { fulfillSimulatedPayment } from "@/lib/data/simulation";
import { openAutomatedWall, payAndPublish, resetAutomatedWall } from "@/lib/testing/harness";

beforeEach(() => {
  openAutomatedWall();
});

afterEach(() => {
  resetAutomatedWall();
});

describe("concurrency", () => {
  it("gives unique public numbers when many visitors pay at once", async () => {
    const marks = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        Promise.resolve(payAndPublish(`Concurrent QA sentence ${index + 1}.`)),
      ),
    );
    const numbers = marks.map((mark) => mark.publicNumber);
    expect(new Set(numbers).size).toBe(12);
  });

  it("replays the same payment to the same number under parallel verify", async () => {
    const mark = payAndPublish("One payment, many confirm clicks.");
    const results = await Promise.all(
      [1, 2, 3, 4].map(() =>
        Promise.resolve(
          fulfillSimulatedPayment({
            intentId: mark.intentId,
            userId: mark.userId,
            paymentId: mark.paymentId,
          }),
        ),
      ),
    );
    expect(new Set(results.map((row) => row.publicNumber))).toEqual(new Set([mark.publicNumber]));
    expect(results.every((row) => row.messageId === mark.messageId)).toBe(true);
  });

  it("does not mint a second sentence when the same intent races", async () => {
    const first = payAndPublish("Race the same intent.");
    try {
      payAndPublish(first.text);
      throw new Error("duplicate sentence was accepted");
    } catch (error) {
      expect((error as { code?: string }).code).toBe(ERROR_CODES.MODERATION_REJECTED);
    }
  });
});
