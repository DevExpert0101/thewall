import { describe, expect, it } from "vitest";
import { ARCHIVAL_REMOVAL_TEXT } from "@/lib/constants";
import { assignFinalRanks, compareHot } from "@/lib/ranking";
import { VICTOR_TIE_POLICY } from "@/lib/monument/policy";

function row(
  publicNumber: number,
  reactionCount: number,
  publishedAt: string,
  extra: { text?: string; isRemoved?: boolean } = {},
) {
  return {
    publicNumber,
    reactionCount,
    publishedAt,
    text: extra.text ?? `#${publicNumber}`,
    isRemoved: extra.isRemoved ?? false,
  };
}

describe("suite 6 — ranking and ties", () => {
  it("orders 500 / 400 / 300 as A, B, C every time", () => {
    const data = [
      row(3, 300, "2026-08-19T10:00:00.000Z", { text: "C" }),
      row(1, 500, "2026-08-19T10:00:00.000Z", { text: "A" }),
      row(2, 400, "2026-08-19T10:00:00.000Z", { text: "B" }),
    ];
    const first = assignFinalRanks(data);
    for (let i = 0; i < 20; i += 1) {
      expect(assignFinalRanks(data).map((item) => item.finalRank)).toEqual(first.map((item) => item.finalRank));
    }
    expect(first.find((item) => item.text === "A")?.finalRank).toBe(1);
    expect(first.find((item) => item.text === "B")?.finalRank).toBe(2);
    expect(first.find((item) => item.text === "C")?.finalRank).toBe(3);
  });

  it("breaks a 500-500 tie by earlier published_at, then lower number", () => {
    expect(VICTOR_TIE_POLICY).toMatch(/earlier published/i);
    const early = row(8, 500, "2026-08-19T09:00:00.000Z", { text: "early" });
    const late = row(2, 500, "2026-08-19T11:00:00.000Z", { text: "late" });
    const ranked = assignFinalRanks([late, early]);
    expect(ranked.find((item) => item.text === "early")?.finalRank).toBe(1);
    expect(compareHot(early, late)).toBeLessThan(0);

    const sameTimeLow = row(1, 500, "2026-08-19T09:00:00.000Z");
    const sameTimeHigh = row(9, 500, "2026-08-19T09:00:00.000Z");
    const tied = assignFinalRanks([sameTimeHigh, sameTimeLow]);
    expect(tied.find((item) => item.publicNumber === 1)?.finalRank).toBe(1);
  });

  it("drops a removed sentence from Victor selection and promotes the next living one", () => {
    const removed = row(4, 900, "2026-08-19T08:00:00.000Z", {
      text: ARCHIVAL_REMOVAL_TEXT,
      isRemoved: true,
    });
    const living = row(5, 100, "2026-08-19T09:00:00.000Z", { text: "still public" });
    const ranked = assignFinalRanks([living, removed]);
    expect(ranked.find((item) => item.publicNumber === 4)?.publicNumber).toBe(4);
    expect(ranked.find((item) => item.publicNumber === 4)?.finalRank).toBeNull();
    expect(ranked.find((item) => item.publicNumber === 4)?.text).toBe(ARCHIVAL_REMOVAL_TEXT);
    expect(ranked.find((item) => item.publicNumber === 5)?.finalRank).toBe(1);
  });
});
