import { describe, expect, it } from "vitest";
import { syncedNowMs } from "@/lib/event/clock";
import { eventPresentation, remainingMsFrom, remainingWholeSeconds } from "@/lib/event/remaining";

describe("synced clock", () => {
  it("advances from the server origin, not a drifted device clock", () => {
    const serverNow = "2026-08-16T20:00:00.000Z";
    const originClient = 1_000_000;
    const driftedClient = originClient + 5 * 60_000;
    expect(syncedNowMs(serverNow, originClient, driftedClient)).toBe(
      new Date("2026-08-16T20:05:00.000Z").getTime(),
    );
    const remaining = remainingMsFrom("2026-08-16T20:00:10.000Z", syncedNowMs(serverNow, originClient, originClient + 2_000));
    expect(remaining).toBe(8_000);
    expect(eventPresentation("live", remaining)).toBe("final-seconds");
    expect(remainingWholeSeconds(remaining)).toBe(8);
  });
});
