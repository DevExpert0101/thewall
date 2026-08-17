import { describe, expect, it } from "vitest";
import {
  CLOSED_LOCK_LINE,
  closedCensusLine,
  closedEditionHeadline,
  countdownLiveBucket,
  countdownLiveText,
  countdownSpokenName,
  eventPresentation,
  formatEventInstant,
  formatRemainingClock,
  liveUrgency,
  publishUrgencyLine,
  remainingLabel,
  remainingMsFrom,
  remainingNotice,
  remainingWholeSeconds,
  remainClause,
  closesInClause,
} from "@/lib/event/remaining";

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

  it("writes share remaining without rounding up", () => {
    expect(closesInClause("2026-08-13T18:00:00.000Z", "2026-08-13T12:00:00.000Z")).toBe(
      "The Wall closes in 6 hours",
    );
    expect(closesInClause("2026-08-13T18:00:00.000Z", "2026-08-13T12:01:00.000Z")).toBe(
      "The Wall closes in 5 hours",
    );
    expect(closesInClause("2026-08-13T18:00:00.000Z", "2026-08-13T17:00:00.000Z")).toBe(
      "The Wall closes in 1 hour",
    );
    expect(closesInClause("2026-08-13T18:00:00.000Z", "2026-08-13T17:48:00.000Z")).toBe(
      "The Wall closes in 12 minutes",
    );
    expect(closesInClause("2026-08-13T18:00:00.000Z", "2026-08-13T18:00:00.000Z")).toBe(
      "The Wall has closed",
    );
    expect(remainClause("2026-08-13T18:00:00.000Z", "2026-08-13T12:00:00.000Z")).toBe("6 hours remain");
  });
});

describe("event presentation", () => {
  it("keeps upcoming distinct from a live countdown", () => {
    expect(eventPresentation("upcoming", 90 * 60 * 1000)).toBe("upcoming");
    expect(eventPresentation("live", 90 * 60 * 1000)).toBe("live");
  });

  it("enters the final hour at T-60 minutes", () => {
    expect(liveUrgency(60 * 60 * 1000)).toBe("hour");
    expect(eventPresentation("live", 60 * 60 * 1000)).toBe("final-hour");
    expect(remainingNotice("final-hour", 60 * 60 * 1000)).toBe("60 MINUTES REMAIN.");
    expect(eventPresentation("live", 60 * 60 * 1000 + 1)).toBe("live");
  });

  it("tightens at ten minutes and the last minute", () => {
    expect(eventPresentation("live", 10 * 60 * 1000)).toBe("final-ten");
    expect(eventPresentation("live", 10 * 60 * 1000 + 1)).toBe("final-hour");
    expect(eventPresentation("live", 60 * 1000)).toBe("final-minute");
    expect(eventPresentation("live", 60 * 1000 + 1)).toBe("final-ten");
    expect(eventPresentation("live", 10 * 1000)).toBe("final-seconds");
    expect(eventPresentation("live", 10 * 1000 + 1)).toBe("final-minute");
    expect(remainingNotice("final-minute", 45_000)).toBe("45 SECONDS REMAIN.");
    expect(remainingNotice("final-seconds", 8_000)).toBe("8 SECONDS REMAIN.");
    expect(remainingWholeSeconds(8_500)).toBe(9);
    expect(remainingWholeSeconds(10_000)).toBe(10);
    expect(remainingWholeSeconds(1)).toBe(1);
    expect(publishUrgencyLine("final-ten")).toMatch(/last minutes are open/i);
  });

  it("closes at zero without waiting for a cron", () => {
    expect(liveUrgency(0)).toBe("closed");
    expect(eventPresentation("live", 0)).toBe("closed");
    expect(eventPresentation("finalizing", 0)).toBe("closed");
    expect(eventPresentation("archived", 12_000)).toBe("closed");
    expect(closedEditionHeadline(1)).toBe("THE WALL №001 HAS CLOSED.");
    expect(closedCensusLine(428193)).toBe("428,193 PEOPLE SPOKE.");
    expect(CLOSED_LOCK_LINE).toBe("NO ONE CAN ADD ANOTHER WORD.");
  });

  it("announces the clock in coarse buckets, never every second", () => {
    expect(countdownLiveBucket(12 * 3600 * 1000 + 45_000)).toBe("hours:12");
    expect(countdownLiveBucket(12 * 3600 * 1000 + 1_000)).toBe("hours:12");
    expect(countdownLiveBucket(11 * 3600 * 1000 + 59 * 60 * 1000)).toBe("hours:11");
    expect(countdownLiveBucket(30 * 60 * 1000)).toBe("final-thirty");
    expect(countdownLiveBucket(10 * 60 * 1000)).toBe("final-ten");
    expect(countdownLiveBucket(5 * 60 * 1000)).toBe("final-five");
    expect(countdownLiveBucket(45_000)).toBe("final-minute");
    expect(countdownLiveBucket(1_000)).toBe("final-minute");
    expect(countdownLiveBucket(0)).toBe("closed");
    expect(countdownLiveText("Remaining", "hours:12")).toBe("Remaining: 12 hours remaining");
    expect(countdownLiveText("Remaining", "final-minute")).toBe(
      "Remaining: less than one minute remaining",
    );
    expect(countdownSpokenName("Remaining", 12 * 3600 * 1000 + 5 * 60 * 1000 + 9_000)).toBe(
      "Remaining: 12 hours, 5 minutes remaining",
    );
    expect(countdownSpokenName("Remaining", 9_000)).toBe(
      "Remaining: less than one minute remaining",
    );
  });

  it("formats the opening instant in UTC", () => {
    expect(formatEventInstant("2026-08-16T18:30:00.000Z")).toBe(
      "AUGUST 16, 2026 · 18:30:00 UTC",
    );
  });
});
