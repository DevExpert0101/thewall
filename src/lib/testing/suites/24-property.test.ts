import { describe, expect, it } from "vitest";
import { MESSAGE_MAX_GRAPHEMES } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { graphemeCount, normalizeMessage, validateMessage } from "@/lib/message/normalize";
import { assignFinalRanks, risingScore } from "@/lib/ranking";

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

describe("suite 24 — property / randomized invariants", () => {
  it("accepts 1..140 graphemes and rejects 141 for seeded strings", () => {
    const rand = mulberry32(20260823);
    const alphabet = "abcxyzéא中🔥- ";
    for (let i = 0; i < 40; i += 1) {
      const length = 1 + Math.floor(rand() * MESSAGE_MAX_GRAPHEMES);
      const text = Array.from({ length }, () => alphabet[Math.floor(rand() * alphabet.length)]).join("");
      const normalized = normalizeMessage(text);
      if (!normalized) {
        expect(() => validateMessage(text)).toThrow(AppError);
        continue;
      }
      expect(validateMessage(text)).toBe(normalized);
      expect(graphemeCount(normalized)).toBeLessThanOrEqual(MESSAGE_MAX_GRAPHEMES);
    }
    expect(() => validateMessage("x".repeat(141))).toThrow(AppError);
    expect(validateMessage("x".repeat(139))).toHaveLength(139);
    expect(validateMessage("x".repeat(140))).toHaveLength(140);
  });

  it("keeps the same #1 for the same finalized set across reshuffles", () => {
    const rand = mulberry32(77);
    const messages = Array.from({ length: 18 }, (_, index) => ({
      publicNumber: index + 1,
      reactionCount: Math.floor(rand() * 40),
      publishedAt: new Date(Date.parse("2026-08-23T10:00:00.000Z") + index * 1000).toISOString(),
    }));
    const first = assignFinalRanks(messages);
    for (let i = 0; i < 20; i += 1) {
      const shuffled = [...messages].sort(() => rand() - 0.5);
      const again = assignFinalRanks(shuffled);
      expect(again.find((row) => row.finalRank === 1)?.publicNumber).toBe(
        first.find((row) => row.finalRank === 1)?.publicNumber,
      );
      expect(new Map(again.map((row) => [row.publicNumber, row.finalRank]))).toEqual(
        new Map(first.map((row) => [row.publicNumber, row.finalRank])),
      );
    }
  });

  it("never NaNs or explodes on extreme rising inputs", () => {
    const rand = mulberry32(99);
    const now = new Date("2026-08-23T12:00:00.000Z");
    for (let i = 0; i < 30; i += 1) {
      const score = risingScore({
        hourCount: rand() * 10_000 - 100,
        hourMinutes: rand() * 200 - 20,
        reactionCount: rand() * 50_000 - 50,
        publishedAt: new Date(now.getTime() - rand() * 48 * 3600_000),
        now,
      });
      expect(Number.isFinite(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(8);
    }
  });
});
