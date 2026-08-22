import { describe, expect, it } from "vitest";
import { foldForModeration } from "@/lib/moderation/fold";
import { RuleBasedModerationProvider, evaluateModeration } from "@/lib/moderation/rules";
import { canProceedToPayment } from "@/lib/moderation/types";

const provider = new RuleBasedModerationProvider();

describe("moderation preflight", () => {
  it("allows ordinary sentences and maps them to the public allowed state", async () => {
    const result = await provider.review({ text: "I hope we were trying." });
    expect(result.status).toBe("approved");
    expect(result.decision).toBe("allowed");
    expect(canProceedToPayment(result)).toBe(true);
  });

  it("keeps the fifty-year seed publishable", () => {
    const result = evaluateModeration(
      "If you are reading this in fifty years, I drove a night bus and I liked the quiet.",
    );
    expect(result.decision).toBe("allowed");
    expect(canProceedToPayment(result)).toBe(true);
  });

  it("rejects repeated-character spam before payment", async () => {
    const result = await provider.review({ text: "a".repeat(50) });
    expect(result.status).toBe("rejected");
    expect(result.decision).toBe("rejected");
    expect(canProceedToPayment(result)).toBe(false);
  });

  it("rejects repeated-word spam before payment", () => {
    const result = evaluateModeration("spam spam spam spam spam spam spam spam");
    expect(result.decision).toBe("rejected");
    expect(canProceedToPayment(result)).toBe(false);
  });

  it("rejects forbidden phrases", async () => {
    const result = await provider.review({ text: "this is child porn" });
    expect(result.status).toBe("rejected");
    expect(canProceedToPayment(result)).toBe(false);
  });

  it("rejects obfuscated forbidden phrases after folding", () => {
    const obfuscated = "this is child p\u043Ern";
    expect(foldForModeration(obfuscated)).toContain("child porn");
    const result = evaluateModeration(obfuscated);
    expect(result.decision).toBe("rejected");
    expect(canProceedToPayment(result)).toBe(false);
  });

  it("rejects personal information before a wallet opens", () => {
    expect(evaluateModeration("email me at visitor@example.com").decision).toBe("rejected");
    expect(evaluateModeration("call me at 415-555-0134").decision).toBe("rejected");
    expect(canProceedToPayment(evaluateModeration("call me at 415-555-0134"))).toBe(false);
  });

  it("rejects direct threats and harassment before payment", () => {
    expect(evaluateModeration("I will kill you tonight").decision).toBe("rejected");
    expect(evaluateModeration("you should die").decision).toBe("rejected");
  });

  it("rejects dangerous links and three-or-more URLs", () => {
    expect(evaluateModeration("open file://secret.txt").decision).toBe("rejected");
    expect(
      evaluateModeration("see http://a.example http://b.example http://c.example").decision,
    ).toBe("rejected");
  });

  it("marks a single ordinary URL as review required without blocking payment", () => {
    const result = evaluateModeration("I wrote this at https://example.com");
    expect(result.status).toBe("flagged");
    expect(result.decision).toBe("review_required");
    expect(canProceedToPayment(result)).toBe(true);
  });

  it("does not put rule codes in the public decision", () => {
    const result = evaluateModeration("visitor@example.com");
    expect(result.decision).toBe("rejected");
    expect(["allowed", "review_required", "rejected"]).toContain(result.decision);
  });
});
