import { describe, expect, it } from "vitest";
import { assertEventLive, countdownTargetIso, deriveEventPhase, isEventClosed, isEventWritable, isReactionAllowed } from "@/lib/event/state";
import { AppError } from "@/lib/errors";

const base = {
  startsAt: "2026-08-14T00:00:00.000Z",
  endsAt: "2026-08-15T00:00:00.000Z",
  archivedAt: null as string | null,
  finalizedAt: null as string | null,
};

describe("event phase", () => {
  it("is upcoming before starts_at", () => {
    expect(deriveEventPhase(base, new Date("2026-08-13T23:59:59.000Z"))).toBe(
      "upcoming",
    );
    expect(isEventWritable("upcoming")).toBe(false);
  });

  it("is live during the window", () => {
    expect(deriveEventPhase(base, new Date("2026-08-14T12:00:00.000Z"))).toBe("live");
    expect(isEventWritable("live")).toBe(true);
  });

  it("is finalizing after ends_at until rankings persist", () => {
    expect(deriveEventPhase(base, new Date("2026-08-15T00:00:00.000Z"))).toBe(
      "finalizing",
    );
    expect(isEventWritable("finalizing")).toBe(false);
  });

  it("is archived once finalized", () => {
    expect(
      deriveEventPhase(
        { ...base, finalizedAt: "2026-08-15T00:00:05.000Z" },
        new Date("2026-08-15T00:01:00.000Z"),
      ),
    ).toBe("archived");
  });

  it("rejects writes during finalizing as well", () => {
    expect(() => assertEventLive("upcoming")).toThrow(AppError);
    expect(() => assertEventLive("live")).not.toThrow();
    expect(() => assertEventLive("finalizing")).toThrow(AppError);
    expect(() => assertEventLive("archived")).toThrow(AppError);
    expect(isEventWritable("finalizing")).toBe(false);
    expect(isEventClosed("upcoming")).toBe(false);
    expect(isEventClosed("live")).toBe(false);
    expect(isEventClosed("finalizing")).toBe(true);
    expect(isEventClosed("archived")).toBe(true);
    expect(isReactionAllowed("live")).toBe(true);
    expect(isReactionAllowed("finalizing")).toBe(false);
    expect(isReactionAllowed("archived")).toBe(false);
  });

  it("points the countdown at launch or close", () => {
    expect(countdownTargetIso("upcoming", base)).toBe(base.startsAt);
    expect(countdownTargetIso("live", base)).toBe(base.endsAt);
  });
});
