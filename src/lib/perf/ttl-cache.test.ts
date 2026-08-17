import { afterEach, describe, expect, it } from "vitest";
import { remember, resetRemembered } from "@/lib/perf/ttl-cache";

afterEach(() => {
  resetRemembered();
});

describe("remember", () => {
  it("returns the cached value inside the TTL", async () => {
    let loads = 0;
    const first = await remember("k", 5_000, async () => {
      loads += 1;
      return "a";
    });
    const second = await remember("k", 5_000, async () => {
      loads += 1;
      return "b";
    });
    expect(first).toBe("a");
    expect(second).toBe("a");
    expect(loads).toBe(1);
  });

  it("coalesces concurrent misses into one load", async () => {
    let loads = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const load = async () => {
      loads += 1;
      await gate;
      return loads;
    };
    const a = remember("burst", 5_000, load);
    const b = remember("burst", 5_000, load);
    release();
    expect(await Promise.all([a, b])).toEqual([1, 1]);
    expect(loads).toBe(1);
  });
});
