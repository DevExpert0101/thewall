import { describe, expect, it } from "vitest";
import type { PublicMessage } from "@/lib/types";
import { WALL_MAX_RENDERED } from "@/lib/wall/constants";
import {
  applyOptimisticReaction,
  applyReactionCounts,
  capFeed,
  feedSortForPhase,
  mergeArrival,
  pageWindow,
  shouldVirtualize,
} from "@/lib/wall/feed";

function msg(n: number, fires = 0): PublicMessage {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    eventId: "local",
    publicNumber: n,
    text: `Sentence ${n}`,
    isRemoved: false,
    reactionCount: fires,
    publishedAt: new Date(Date.now() - n * 1000).toISOString(),
    finalRank: null,
  };
}

describe("wall feed", () => {
  it("pages without returning the whole wall", () => {
    const items = Array.from({ length: 18 }, (_, i) => i + 1);
    const first = pageWindow(items, undefined, 12);
    expect(first.items).toEqual(items.slice(0, 12));
    expect(first.nextCursor).toBe("12");
    const second = pageWindow(items, first.nextCursor ?? undefined, 12);
    expect(second.items).toEqual([13, 14, 15, 16, 17, 18]);
    expect(second.nextCursor).toBeNull();
  });

  it("prepends a realtime arrival once and caps the rendered list", () => {
    const current = Array.from({ length: WALL_MAX_RENDERED }, (_, i) => msg(i + 1));
    const incoming = msg(500, 0);
    const merged = mergeArrival(current, incoming);
    expect(merged[0]?.publicNumber).toBe(500);
    expect(merged).toHaveLength(WALL_MAX_RENDERED);
    expect(mergeArrival(merged, incoming)).toHaveLength(WALL_MAX_RENDERED);
    expect(shouldVirtualize(merged.length)).toBe(false);
  });

  it("applies optimistic 🔥 without letting a stale pulse roll it back", () => {
    const list = [msg(1, 4), msg(2, 1)];
    const first = list[0];
    const second = list[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) return;
    const optimistic = applyOptimisticReaction(list, first.id, 5);
    expect(optimistic[0]?.reactionCount).toBe(5);
    const pulsed = applyReactionCounts(optimistic, { [first.id]: 4, [second.id]: 9 });
    expect(pulsed[0]?.reactionCount).toBe(5);
    expect(pulsed[1]?.reactionCount).toBe(9);
  });

  it("does not keep thousands of rows in memory", () => {
    const huge = Array.from({ length: 4000 }, (_, i) => msg(i + 1));
    expect(capFeed(huge)).toHaveLength(WALL_MAX_RENDERED);
    expect(shouldVirtualize(4000)).toBe(true);
    expect(shouldVirtualize(WALL_MAX_RENDERED)).toBe(false);
  });

  it("locks time-varying sorts after the wall closes", () => {
    expect(feedSortForPhase("live", "trending")).toBe("trending");
    expect(feedSortForPhase("upcoming", "hour")).toBe("hour");
    expect(feedSortForPhase("finalizing", "trending")).toBe("hot");
    expect(feedSortForPhase("archived", "hour")).toBe("hot");
    expect(feedSortForPhase("archived", "new")).toBe("new");
  });
});
