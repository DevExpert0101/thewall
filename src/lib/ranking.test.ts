import { describe, expect, it } from "vitest";
import { assignFinalRanks, trendingScore } from "@/lib/ranking";
import { ARCHIVAL_REMOVAL_TEXT } from "@/lib/constants";
import { cacheForPhase, PULSE_CACHE_CONTROL } from "@/lib/data/event";

describe("trending score", () => {
  it("scores a brand-new message as count / 2^1.5", () => {
    const now = new Date("2026-08-14T12:00:00Z");
    const published = new Date("2026-08-14T12:00:00Z");
    expect(trendingScore(8, published, now)).toBeCloseTo(8 / Math.pow(2, 1.5));
  });

  it("decays with age", () => {
    const now = new Date("2026-08-14T14:00:00Z");
    const published = new Date("2026-08-14T12:00:00Z");
    const newer = trendingScore(10, new Date("2026-08-14T13:30:00Z"), now);
    const older = trendingScore(10, published, now);
    expect(newer).toBeGreaterThan(older);
  });
});

describe("final ranks", () => {
  it("matches hot order and keeps removed numbers", () => {
    const ranked = assignFinalRanks([
      { publicNumber: 2, reactionCount: 10, publishedAt: "2026-08-13T10:00:00.000Z", text: "later" },
      { publicNumber: 1, reactionCount: 10, publishedAt: "2026-08-13T09:00:00.000Z", text: ARCHIVAL_REMOVAL_TEXT },
      { publicNumber: 3, reactionCount: 4, publishedAt: "2026-08-13T08:00:00.000Z", text: "quiet" },
    ]);
    const byNumber = Object.fromEntries(ranked.map((row) => [row.publicNumber, row.finalRank]));
    expect(byNumber[1]).toBe(1);
    expect(byNumber[2]).toBe(2);
    expect(byNumber[3]).toBe(3);
    expect(ranked.find((row) => row.publicNumber === 1)?.text).toBe(ARCHIVAL_REMOVAL_TEXT);
  });

  it("is idempotent", () => {
    const input = [
      { publicNumber: 1, reactionCount: 2, publishedAt: "2026-08-13T09:00:00.000Z" },
      { publicNumber: 2, reactionCount: 8, publishedAt: "2026-08-13T10:00:00.000Z" },
    ];
    expect(assignFinalRanks(assignFinalRanks(input)).map((row) => row.finalRank)).toEqual(
      assignFinalRanks(input).map((row) => row.finalRank),
    );
  });
});

describe("archive cache", () => {
  it("caches archived public reads aggressively and keeps live short", () => {
    expect(cacheForPhase("archived")).toContain("s-maxage=3600");
    expect(cacheForPhase("archived")).toContain("stale-while-revalidate=604800");
    expect(cacheForPhase("live")).toContain("s-maxage=3");
    expect(cacheForPhase("finalizing")).toContain("s-maxage=15");
    expect(PULSE_CACHE_CONTROL).toContain("private");
    expect(PULSE_CACHE_CONTROL).not.toContain("s-maxage");
  });
});
