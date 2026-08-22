import { describe, expect, it } from "vitest";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { preflightMessage } from "@/lib/publish/preflight";

describe("publish preflight", () => {
  it("returns the normalized sentence when validation and moderation pass", async () => {
    const result = await preflightMessage("  I was here.  ");
    expect(result.text).toBe("I was here.");
    expect(result.moderationStatus).toBe("approved");
    expect(result.decision).toBe("allowed");
  });

  it("returns review_required for a single URL without opening a reject path", async () => {
    const result = await preflightMessage("I wrote this at https://example.com");
    expect(result.decision).toBe("review_required");
    expect(result.moderationStatus).toBe("flagged");
  });

  it("explains a rejection without naming the rule", async () => {
    await expect(preflightMessage("visitor@example.com")).rejects.toMatchObject({
      code: ERROR_CODES.MODERATION_REJECTED,
      message: "This sentence cannot be published.",
    } satisfies Partial<AppError>);
  });

  it("rejects empty text before payment", async () => {
    await expect(preflightMessage("   ")).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION,
    } satisfies Partial<AppError>);
  });

  it("rejects more than 140 graphemes", async () => {
    await expect(preflightMessage("a".repeat(141))).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION,
    } satisfies Partial<AppError>);
  });

  it("stops spam before a wallet opens", async () => {
    await expect(preflightMessage("a".repeat(50))).rejects.toMatchObject({
      code: ERROR_CODES.MODERATION_REJECTED,
    } satisfies Partial<AppError>);
  });
});
