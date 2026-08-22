import { describe, expect, it } from "vitest";
import { formatExclude, parseExclude, pickPublicNumbers } from "@/lib/wall/random";

describe("random urn", () => {
  it("picks uniformly from remaining public numbers without scanning a huge table", () => {
    const picks = pickPublicNumbers({
      maxNumber: 10_000,
      exclude: [4, 8],
      count: 3,
      random: (() => {
        let i = 0;
        const stream = [0.12, 0.12, 0.44, 0.81];
        return () => stream[i++] ?? 0.5;
      })(),
    });
    expect(picks).toHaveLength(3);
    expect(new Set(picks).size).toBe(3);
    expect(picks.every((n) => n >= 1 && n <= 10_000)).toBe(true);
    expect(picks).not.toContain(4);
    expect(picks).not.toContain(8);
  });

  it("returns nothing when the urn is empty so the client can reshuffle", () => {
    expect(
      pickPublicNumbers({
        maxNumber: 3,
        exclude: [1, 2, 3],
        count: 2,
      }),
    ).toEqual([]);
  });

  it("builds a small remaining pool instead of rejection when few numbers are left", () => {
    const picks = pickPublicNumbers({
      maxNumber: 5,
      exclude: [1, 2, 4],
      count: 4,
      random: () => 0,
    });
    expect(picks.sort((a, b) => a - b)).toEqual([3, 5]);
  });

  it("caps the exclude list so the query string stays small", () => {
    const raw = Array.from({ length: 80 }, (_, i) => i + 1).join(",");
    const parsed = parseExclude(raw);
    expect(parsed).toHaveLength(48);
    expect(formatExclude([0, 4, 4, -1, 12])).toBe("4,12");
  });
});
