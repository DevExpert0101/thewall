import { describe, expect, it } from "vitest";
import { assertEventLive, assertPublishOpen, assertReactOpen, assertWritesOpen, countdownTargetIso, deriveEventPhase, isEventClosed, isEventSealed, isEventWritable, isReactionAllowed, publicMessageForPhase, publicPhaseLabel, reconcilePublicPhase } from "@/lib/event/state";
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

  it("stays finalizing after review close even if the clock steps backward", () => {
    expect(
      deriveEventPhase(
        { ...base, reviewClosedAt: "2026-08-14T18:00:00.000Z" },
        new Date("2026-08-14T17:59:59.000Z"),
      ),
    ).toBe("finalizing");
    expect(() =>
      assertWritesOpen(
        {
          phase: "live",
          endsAt: "2026-08-15T00:00:00.000Z",
          reviewClosedAt: "2026-08-14T18:00:00.000Z",
        },
        new Date("2026-08-14T17:59:59.000Z"),
      ),
    ).toThrow(AppError);
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
    expect(isEventSealed("finalizing")).toBe(false);
    expect(isEventSealed("archived")).toBe(true);
    expect(isReactionAllowed("live")).toBe(true);
    expect(isReactionAllowed("finalizing")).toBe(false);
    expect(isReactionAllowed("archived")).toBe(false);
  });

  it("uses public words instead of internal phase slugs", () => {
    expect(publicPhaseLabel("finalizing")).toBe("Closed for review");
    expect(publicPhaseLabel("archived")).toBe("Sealed");
    expect(publicPhaseLabel("live")).toBe("Live");
  });

  it("hides final ranks until the edition is disclosed", () => {
    const message = {
      id: "m",
      eventId: "e",
      publicNumber: 4,
      text: "I hope we still have fifty years.",
      isRemoved: false,
      reactionCount: 9,
      publishedAt: "2026-08-14T12:00:00.000Z",
      finalRank: 1,
    };
    expect(publicMessageForPhase(message, "finalizing").finalRank).toBeNull();
    expect(publicMessageForPhase(message, "live").finalRank).toBeNull();
    expect(publicMessageForPhase(message, "archived").finalRank).toBe(1);
  });

  it("rejects a delayed write after ends_at even if the payload still says live", () => {
    expect(() =>
      assertWritesOpen(
        { phase: "live", endsAt: "2026-08-15T00:00:00.000Z" },
        new Date("2026-08-15T00:00:00.500Z"),
      ),
    ).toThrow(AppError);
    expect(() =>
      assertWritesOpen(
        { phase: "live", endsAt: "2026-08-15T00:00:01.000Z" },
        new Date("2026-08-15T00:00:00.000Z"),
      ),
    ).not.toThrow();
    expect(() =>
      assertPublishOpen(
        { phase: "live", endsAt: "2026-08-15T00:00:01.000Z" },
        { publishEnabled: false, reactEnabled: true, strictBot: false },
        new Date("2026-08-15T00:00:00.000Z"),
      ),
    ).toThrow(AppError);
    expect(() =>
      assertReactOpen(
        { phase: "live", endsAt: "2026-08-15T00:00:01.000Z" },
        { publishEnabled: true, reactEnabled: false, strictBot: false },
        new Date("2026-08-15T00:00:00.000Z"),
      ),
    ).toThrow(AppError);
  });

  it("accepts a new Wall after the previous day was sealed", () => {
    expect(
      reconcilePublicPhase({
        reported: "live",
        endsAt: "2026-08-16T12:05:00.000Z",
        now: "2026-08-16T12:01:00.000Z",
        previous: "archived",
        startsAt: "2026-08-16T12:00:00.000Z",
        previousStartsAt: "2026-08-15T01:00:00.000Z",
        editionNumber: 6,
        previousEditionNumber: 5,
      }),
    ).toBe("live");
  });

  it("does not reopen from a stale live packet after the clock has closed", () => {
    expect(
      reconcilePublicPhase({
        reported: "live",
        endsAt: "2026-08-15T00:00:00.000Z",
        now: "2026-08-15T00:00:02.000Z",
        previous: "finalizing",
      }),
    ).toBe("finalizing");
    expect(
      reconcilePublicPhase({
        reported: "live",
        endsAt: "2026-08-15T00:00:10.000Z",
        now: "2026-08-15T00:00:02.000Z",
        previous: "finalizing",
      }),
    ).toBe("finalizing");
  });

  it("points the countdown at launch or close", () => {
    expect(countdownTargetIso("upcoming", base)).toBe(base.startsAt);
    expect(countdownTargetIso("live", base)).toBe(base.endsAt);
  });
});
