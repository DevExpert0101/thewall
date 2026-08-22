import { describe, expect, it } from "vitest";
import {
  assignFinalRanks,
  compareHot,
  gemScore,
  hiddenGemCutoff,
  inFinalHour,
  isHiddenGem,
  risingParts,
  risingScore,
  RISING_SCORE_CAP,
  selectHiddenGems,
} from "@/lib/ranking";
import { ARCHIVAL_REMOVAL_TEXT } from "@/lib/constants";
import { cacheForPhase, PULSE_CACHE_CONTROL } from "@/lib/data/event";

describe("rising score", () => {
  const now = new Date("2026-08-14T12:00:00Z");

  it("is zero for empty inputs and never divides by zero", () => {
    expect(
      risingScore({
        hourCount: 0,
        hourMinutes: 0,
        reactionCount: 0,
        publishedAt: now,
        now,
      }),
    ).toBe(0);
    expect(
      risingScore({
        hourCount: Number.NaN,
        hourMinutes: Number.POSITIVE_INFINITY,
        reactionCount: -4,
        publishedAt: new Date("not-a-date"),
        now,
      }),
    ).toBe(0);
  });

  it("lets a fresh sentence beat an old high-🔥 drip", () => {
    const fresh = risingScore({
      hourCount: 8,
      hourMinutes: 6,
      reactionCount: 8,
      publishedAt: new Date("2026-08-14T11:50:00Z"),
      now,
    });
    const famous = risingScore({
      hourCount: 3,
      hourMinutes: 3,
      reactionCount: 67,
      publishedAt: new Date("2026-08-14T07:00:00Z"),
      now,
    });
    expect(fresh).toBeGreaterThan(famous);
  });

  it("does not let a one-minute burst outrank a spread hour", () => {
    const burst = risingScore({
      hourCount: 80,
      hourMinutes: 1,
      reactionCount: 80,
      publishedAt: new Date("2026-08-14T11:58:00Z"),
      now,
    });
    const organic = risingScore({
      hourCount: 12,
      hourMinutes: 8,
      reactionCount: 12,
      publishedAt: new Date("2026-08-14T11:30:00Z"),
      now,
    });
    expect(organic).toBeGreaterThan(burst);
  });

  it("caps velocity and lifetime so extreme piles cannot explode the number", () => {
    const base = {
      hourMinutes: 20,
      publishedAt: now,
      now,
    };
    expect(
      risingScore({ ...base, hourCount: 10_000, reactionCount: 40 }),
    ).toBeCloseTo(risingScore({ ...base, hourCount: 40, reactionCount: 40 }));
    expect(
      risingScore({ ...base, hourCount: 40, reactionCount: 10_000 }),
    ).toBeCloseTo(risingScore({ ...base, hourCount: 40, reactionCount: 400 }));
    expect(risingScore({ ...base, hourCount: 10_000, reactionCount: 10_000 })).toBeLessThanOrEqual(
      RISING_SCORE_CAP,
    );
  });

  it("decays with age when velocity and lifetime stay equal", () => {
    const newer = risingScore({
      hourCount: 10,
      hourMinutes: 8,
      reactionCount: 10,
      publishedAt: new Date("2026-08-14T11:30:00Z"),
      now,
    });
    const older = risingScore({
      hourCount: 10,
      hourMinutes: 8,
      reactionCount: 10,
      publishedAt: new Date("2026-08-14T06:00:00Z"),
      now,
    });
    expect(newer).toBeGreaterThan(older);
    const parts = risingParts({
      hourCount: 10,
      hourMinutes: 8,
      reactionCount: 10,
      publishedAt: now,
      now,
    });
    expect(parts.freshness).toBe(1);
    expect(parts.spread).toBeCloseTo(8 / 12);
  });
});

describe("hidden gems", () => {
  it("drops only the loudest when fewer than five messages have 🔥", () => {
    expect(hiddenGemCutoff([9, 4, 1])).toBe(9);
    expect(isHiddenGem(4, 9)).toBe(true);
    expect(isHiddenGem(9, 9)).toBe(false);
    expect(isHiddenGem(2, 9)).toBe(false);
  });

  it("drops the top 20% by lifetime 🔥 once the board is large enough", () => {
    const counts = [40, 30, 20, 15, 12, 8, 6, 4, 3, 1];
    expect(hiddenGemCutoff(counts)).toBe(30);
    expect(isHiddenGem(20, 30)).toBe(true);
    expect(isHiddenGem(30, 30)).toBe(false);
  });

  it("ranks remaining gems by 🔥 / (hours + 2), then newest", () => {
    const now = new Date("2026-08-14T12:00:00Z");
    const gems = selectHiddenGems(
      [
        { id: "loud", reactionCount: 40, publishedAt: "2026-08-14T06:00:00Z" },
        { id: "gem", reactionCount: 8, publishedAt: "2026-08-14T10:00:00Z" },
        { id: "quiet", reactionCount: 2, publishedAt: "2026-08-14T11:00:00Z" },
        { id: "older", reactionCount: 8, publishedAt: "2026-08-14T04:00:00Z" },
      ],
      now,
    );
    expect(gems.map((row) => row.id)).toEqual(["gem", "older"]);
    expect(gemScore(8, new Date("2026-08-14T10:00:00Z"), now)).toBeCloseTo(8 / 4);
    expect(gemScore(8, new Date("2026-08-14T04:00:00Z"), now)).toBeCloseTo(8 / 10);
  });
});

describe("final hour", () => {
  it("keeps the last hour of this Wall, not a rolling clock after close", () => {
    const endsAt = "2026-08-14T12:00:00.000Z";
    expect(inFinalHour("2026-08-14T11:00:00.000Z", endsAt)).toBe(true);
    expect(inFinalHour("2026-08-14T12:00:00.000Z", endsAt)).toBe(true);
    expect(inFinalHour("2026-08-14T10:59:59.000Z", endsAt)).toBe(false);
    expect(inFinalHour("2026-08-14T12:00:01.000Z", endsAt)).toBe(false);
  });
});

describe("final ranks", () => {
  it("breaks 🔥 ties by earlier published inscription, then lower number", () => {
    const earlier = { publicNumber: 9, reactionCount: 10, publishedAt: "2026-08-13T09:00:00.000Z" };
    const later = { publicNumber: 2, reactionCount: 10, publishedAt: "2026-08-13T10:00:00.000Z" };
    const sameTimeHigher = { publicNumber: 8, reactionCount: 10, publishedAt: "2026-08-13T09:00:00.000Z" };
    expect(compareHot(earlier, later)).toBeLessThan(0);
    expect(compareHot(earlier, sameTimeHigher)).toBeGreaterThan(0);
    const ranked = assignFinalRanks([later, sameTimeHigher, earlier]);
    expect(ranked.find((row) => row.publicNumber === 8)?.finalRank).toBe(1);
    expect(ranked.find((row) => row.publicNumber === 9)?.finalRank).toBe(2);
    expect(ranked.find((row) => row.publicNumber === 2)?.finalRank).toBe(3);
  });

  it("matches hot order and keeps removed numbers off the Victor ladder", () => {
    const ranked = assignFinalRanks([
      { publicNumber: 2, reactionCount: 10, publishedAt: "2026-08-13T10:00:00.000Z", text: "later" },
      {
        publicNumber: 1,
        reactionCount: 10,
        publishedAt: "2026-08-13T09:00:00.000Z",
        text: ARCHIVAL_REMOVAL_TEXT,
        isRemoved: true,
      },
      { publicNumber: 3, reactionCount: 4, publishedAt: "2026-08-13T08:00:00.000Z", text: "quiet" },
    ]);
    const byNumber = Object.fromEntries(ranked.map((row) => [row.publicNumber, row.finalRank]));
    expect(byNumber[1]).toBeNull();
    expect(byNumber[2]).toBe(1);
    expect(byNumber[3]).toBe(2);
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
