import { describe, expect, it } from "vitest";
import { risingSignals } from "@/lib/abuse/rising-signals";
import { risingScore } from "@/lib/ranking";

describe("rising anti-manipulation signals", () => {
  it("flags a one-minute pile without changing the public score", () => {
    const now = new Date("2026-08-14T12:00:00Z");
    const published = new Date("2026-08-14T11:59:00Z");
    const input = { hourCount: 80, hourMinutes: 1, reactionCount: 80, publishedAt: published, now };
    const score = risingScore(input);
    const signals = risingSignals({
      hourCount: 80,
      hourMinutes: 1,
      hoursSincePublish: 1 / 60,
    });
    expect(signals.burst).toBe(true);
    expect(signals.youngBurst).toBe(true);
    expect(signals.lowSpread).toBe(true);
    expect(signals.burstRatio).toBe(80);
    expect(risingScore(input)).toBe(score);
  });

  it("leaves an organic hour quiet", () => {
    const signals = risingSignals({
      hourCount: 12,
      hourMinutes: 8,
      hoursSincePublish: 0.5,
    });
    expect(signals.burst).toBe(false);
    expect(signals.youngBurst).toBe(false);
    expect(signals.lowSpread).toBe(false);
    expect(signals.burstRatio).toBeCloseTo(1.5);
  });
});
