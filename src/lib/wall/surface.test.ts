import { describe, expect, it } from "vitest";
import { LIVE_FONT_MIN_PX } from "@/lib/wall/constants";
import { boxesOverlap, layoutLiveWall, liveFontPx } from "@/lib/wall/surface";
import type { PublicMessage } from "@/lib/types";

function message(n: number, extra: Partial<PublicMessage> = {}): PublicMessage {
  return {
    id: `msg-${n}`,
    eventId: "local",
    publicNumber: n,
    text: extra.text ?? `Sentence ${n} on the wall.`,
    isRemoved: false,
    reactionCount: extra.reactionCount ?? n,
    publishedAt: "2026-08-13T12:00:00.000Z",
    finalRank: null,
    ...extra,
  };
}

describe("live wall surface", () => {
  it("makes a hotter sentence larger than a quieter one", () => {
    const quiet = liveFontPx(1, 80, 12);
    const hot = liveFontPx(80, 80, 12);
    expect(hot).toBeGreaterThan(quiet);
    expect(quiet).toBeGreaterThanOrEqual(LIVE_FONT_MIN_PX);
  });

  it("shrinks type as more sentences share the same screen", () => {
    const few = liveFontPx(20, 20, 6);
    const many = liveFontPx(20, 20, 200);
    expect(many).toBeLessThan(few);
  });

  it("places every sentence without overlapping", () => {
    const messages = Array.from({ length: 18 }, (_, i) => message(i + 1, { reactionCount: (i + 1) * 3 }));
    const layout = layoutLiveWall(messages, { width: 1200, height: 720 });
    expect(layout).toHaveLength(18);
    for (let i = 0; i < layout.length; i += 1) {
      const a = layout[i]!;
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.x + a.width).toBeLessThanOrEqual(1200 + 0.01);
      expect(a.y + a.height).toBeLessThanOrEqual(720 + 0.01);
      for (let j = i + 1; j < layout.length; j += 1) {
        expect(boxesOverlap(a, layout[j]!)).toBe(false);
      }
    }
    const quiet = layout.find((item) => item.publicNumber === 1);
    const hot = layout.find((item) => item.publicNumber === 18);
    expect(hot?.fontSize).toBeGreaterThan(quiet?.fontSize ?? 0);
  });
});
