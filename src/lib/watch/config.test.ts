import { describe, expect, it } from "vitest";
import { defaultCycleSec, parseWatchQuery, watchPath } from "@/lib/watch/config";

describe("watch query", () => {
  it("defaults to Auto Wall without a cycle", () => {
    expect(parseWatchQuery({})).toEqual({ mode: "auto", cycleSec: 0, stream: false });
  });

  it("turns Random Human cycling on by default and accepts a pause", () => {
    expect(parseWatchQuery({ mode: "random" }).cycleSec).toBe(12);
    expect(parseWatchQuery({ mode: "random", cycle: "0" }).cycleSec).toBe(0);
    expect(parseWatchQuery({ mode: "rising", stream: true }).cycleSec).toBe(10);
  });

  it("builds a stable OBS url", () => {
    expect(watchPath({ stream: true, mode: "rising", cycleSec: 10 })).toBe(
      "/watch/stream?mode=rising&cycle=10",
    );
    expect(defaultCycleSec("top", true)).toBe(0);
  });
});
