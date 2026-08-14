import { describe, expect, it } from "vitest";
import { formatRemainingClock, remainingLabel, remainingMsFrom } from "@/lib/event/remaining";

describe("remaining clock", () => {
  it("formats a live countdown as HH:MM:SS REMAINING", () => {
    const endsAt = "2026-08-13T18:00:00.000Z";
    const now = "2026-08-13T00:17:51.000Z";
    expect(remainingMsFrom(endsAt, now)).toBe((17 * 3600 + 42 * 60 + 9) * 1000);
    expect(formatRemainingClock(remainingMsFrom(endsAt, now))).toBe("17:42:09");
    expect(remainingLabel(endsAt, now)).toBe("17:42:09 REMAINING");
  });

  it("does not go negative after close", () => {
    expect(remainingLabel("2026-08-13T00:00:00.000Z", "2026-08-13T01:00:00.000Z")).toBe(
      "00:00:00 REMAINING",
    );
  });
});
