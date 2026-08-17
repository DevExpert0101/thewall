import { describe, expect, it } from "vitest";
import { hashToken, tokensEqual } from "@/lib/crypto";
import { sanitizeAnalyticsMetadata } from "@/lib/analytics";
import { formatPublicNumber, parsePublicNumber } from "@/lib/utils";

describe("certificate tokens", () => {
  it("rejects invalid tokens by hash mismatch", () => {
    const a = hashToken("a".repeat(64));
    const b = hashToken("b".repeat(64));
    expect(tokensEqual(a, b)).toBe(false);
    expect(tokensEqual(a, a)).toBe(true);
  });
});

describe("analytics hygiene", () => {
  it("strips message text, wallets, and tokens", () => {
    const clean = sanitizeAnalyticsMetadata({
      via: "card",
      message: "secret sentence",
      wallet: "0xabc",
      token: "fff",
      publicNumber: 12,
    });
    expect(clean).toEqual({ via: "card", publicNumber: 12 });
  });

  it("drops raw IP values even when the key is innocuous", () => {
    const clean = sanitizeAnalyticsMetadata({
      via: "card",
      source: "203.0.113.9",
    });
    expect(clean).toEqual({ via: "card" });
    expect(JSON.stringify(clean)).not.toContain("203.0.113");
  });

  it("drops Wall Keys even when the field name is innocuous", () => {
    const clean = sanitizeAnalyticsMetadata({
      via: "publish",
      note: "7K9P-X4MF-82QH-K3R2",
      publicNumber: 4291,
    });
    expect(clean).toEqual({ via: "publish", publicNumber: 4291 });
    expect(JSON.stringify(clean)).not.toContain("7K9P");
  });
});

describe("public numbers", () => {
  it("formats immutable display numbers", () => {
    expect(formatPublicNumber(1)).toBe("#000001");
    expect(formatPublicNumber(4291)).toBe("#004291");
    expect(formatPublicNumber(100000)).toBe("#100000");
    expect(parsePublicNumber("#004291")).toBe(4291);
  });
});
