import { describe, expect, it } from "vitest";
import { graphemeCount, normalizeMessage, validateMessage } from "@/lib/message/normalize";
import { AppError } from "@/lib/errors";

describe("message normalization", () => {
  it("trims and NFC-normalizes without changing punctuation", () => {
    expect(normalizeMessage("  Hello, world!  ")).toBe("Hello, world!");
    expect(normalizeMessage("wait—what?")).toBe("wait—what?");
  });

  it("strips control and bidi characters", () => {
    expect(normalizeMessage("hi\u0007there\u202E")).toBe("hithere");
  });

  it("rejects empty and whitespace-only", () => {
    expect(() => validateMessage("   ")).toThrow(AppError);
    expect(() => validateMessage("\n\t")).toThrow(AppError);
  });

  it("rejects more than 140 graphemes", () => {
    const text = "a".repeat(141);
    expect(graphemeCount(text)).toBe(141);
    expect(() => validateMessage(text)).toThrow(AppError);
  });

  it("accepts 140 graphemes including emoji", () => {
    const text = "a".repeat(139) + "🔥";
    expect(validateMessage(text)).toBe(text);
  });

  it("accepts one character, RTL, and a long unbroken token", () => {
    expect(validateMessage("א")).toBe("א");
    expect(validateMessage("جملة قصيرة")).toBe("جملة قصيرة");
    expect(validateMessage("x".repeat(139))).toHaveLength(139);
    expect(validateMessage(`https://example.test/${"a".repeat(80)}`)).toContain("example.test");
  });
});
