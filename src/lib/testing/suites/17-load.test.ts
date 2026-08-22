import { afterEach, describe, expect, it } from "vitest";
import { listSimulatedMessages } from "@/lib/data/simulation";
import { classifyTestTarget, remoteTestBaseUrl } from "@/lib/testing/guard";
import { openShortLiveWall, payAndPublish, resetAutomatedWall } from "@/lib/testing/harness";

afterEach(() => {
  resetAutomatedWall();
});

const viewers = Math.min(Number(process.env.TEST_LOAD_VIEWERS || 100), 5000);
const allowHeavy = process.env.TEST_LOAD_ALLOW_HEAVY === "1";
const n = allowHeavy ? viewers : Math.min(viewers, 200);

describe("suite 17 — load (in-process, never production)", () => {
  it(`serves ${n} concurrent leaderboard reads without corrupting numbers`, async () => {
    expect(classifyTestTarget()).toBe("local");
    openShortLiveWall();
    payAndPublish("Load read sentence.");
    const started = Date.now();
    const pages = await Promise.all(
      Array.from({ length: n }, () => Promise.resolve(listSimulatedMessages({ sort: "hot", limit: 20 }))),
    );
    const elapsed = Date.now() - started;
    expect(pages).toHaveLength(n);
    expect(pages.every((page) => page.messages.length > 0)).toBe(true);
    const first = pages[0]?.messages.map((row) => row.publicNumber).join(",");
    expect(pages.every((page) => page.messages.map((row) => row.publicNumber).join(",") === first)).toBe(true);
    expect(elapsed).toBeLessThan(15_000);
  });
});

describe.skipIf(!remoteTestBaseUrl() || !process.env.TEST_LOAD)("suite 17 — remote load (opt-in)", () => {
  it("stays under a safety cap and records timings", async () => {
    const origin = remoteTestBaseUrl() as string;
    const cap = Math.min(n, 100);
    const times: number[] = [];
    let errors = 0;
    await Promise.all(
      Array.from({ length: cap }, async () => {
        const t = Date.now();
        try {
          const res = await fetch(`${origin}/api/event`);
          if (!res.ok) errors += 1;
        } catch {
          errors += 1;
        }
        times.push(Date.now() - t);
      }),
    );
    const avg = times.reduce((sum, ms) => sum + ms, 0) / times.length;
    expect(errors / cap).toBeLessThan(0.05);
    expect(avg).toBeLessThan(5_000);
  });
});
