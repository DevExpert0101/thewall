import { afterEach, describe, expect, it } from "vitest";
import { simulatedMessageList } from "@/lib/data/simulation";
import { openShortLiveWall, payAndPublish, resetAutomatedWall } from "@/lib/testing/harness";

afterEach(() => {
  resetAutomatedWall();
});

/**
 * Numbering contract (from publish_paid_message):
 * event_counters is locked, then incremented. UNIQUE (event_id, public_number)
 * is the last defense. A failed insert rolls the whole RPC back, so a
 * rejected publish does not consume a number. Committed numbers are unique
 * and sequential. Gaps are not part of the success path.
 *
 * Simulation assigns SEEDS.length + extraWrites.length + 1, which is also
 * unique and sequential among committed extra writes.
 */
function assertUniqueSequential(numbers: number[]) {
  const sorted = [...numbers].sort((a, b) => a - b);
  expect(new Set(sorted).size).toBe(sorted.length);
  for (let i = 1; i < sorted.length; i += 1) {
    expect(sorted[i]).toBe((sorted[i - 1] ?? 0) + 1);
  }
}

describe("suite 4 — message number concurrency", () => {
  it.each([100, 500, 1000])("assigns unique sequential numbers to %s concurrent publishes", async (count) => {
    openShortLiveWall();
    const before = new Set(simulatedMessageList().map((row) => row.publicNumber));
    const marks = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        Promise.resolve(payAndPublish(`Numbered QA sentence ${count}-${index}.`)),
      ),
    );
    expect(marks).toHaveLength(count);
    const extras = marks.map((mark) => mark.publicNumber);
    expect(extras.some((n) => before.has(n))).toBe(false);
    assertUniqueSequential(extras);
    const all = simulatedMessageList().map((row) => row.publicNumber);
    expect(new Set(all).size).toBe(all.length);
  }, 60_000);
});
