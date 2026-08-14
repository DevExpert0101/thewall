import { describe, expect, it } from "vitest";
import { RuleBasedModerationProvider } from "@/lib/moderation/rules";
import { canProceedToPayment } from "@/lib/moderation/types";

const provider = new RuleBasedModerationProvider();

describe("moderation preflight", () => {
  it("approves ordinary sentences", async () => {
    const result = await provider.review({ text: "I hope we were trying." });
    expect(result.status).toBe("approved");
    expect(canProceedToPayment(result)).toBe(true);
  });

  it("rejects repeated-character spam before payment", async () => {
    const result = await provider.review({ text: "a".repeat(50) });
    expect(result.status).toBe("rejected");
    expect(canProceedToPayment(result)).toBe(false);
  });

  it("rejects forbidden phrases", async () => {
    const result = await provider.review({ text: "this is child porn" });
    expect(result.status).toBe("rejected");
    expect(canProceedToPayment(result)).toBe(false);
  });
});
