import { describe, expect, it } from "vitest";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { assertHistoricalTimestampEdit, clockFieldsWouldChange } from "@/lib/event/admin-edit";

describe("historical event timestamps", () => {
  it("blocks post-launch window edits without CLOCK", () => {
    expect(() =>
      assertHistoricalTimestampEdit({
        launched: true,
        changingWindow: true,
        confirmed: false,
      }),
    ).toThrow(AppError);
    expect(() =>
      assertHistoricalTimestampEdit({
        launched: true,
        changingWindow: true,
        confirmed: true,
        confirmText: "yes",
      }),
    ).toThrow(AppError);
    try {
      assertHistoricalTimestampEdit({
        launched: true,
        changingWindow: true,
        confirmed: true,
        confirmText: "",
      });
    } catch (error) {
      expect((error as AppError).code).toBe(ERROR_CODES.CONFIRMATION_REQUIRED);
      expect((error as AppError).status).toBe(409);
    }
  });

  it("allows CLOCK-confirmed edits and pre-launch or title-only changes", () => {
    expect(() =>
      assertHistoricalTimestampEdit({
        launched: true,
        changingWindow: true,
        confirmed: true,
        confirmText: "CLOCK",
      }),
    ).not.toThrow();
    expect(() =>
      assertHistoricalTimestampEdit({
        launched: false,
        changingWindow: true,
        confirmed: false,
      }),
    ).not.toThrow();
    expect(() =>
      assertHistoricalTimestampEdit({
        launched: true,
        changingWindow: false,
        confirmed: false,
      }),
    ).not.toThrow();
  });

  it("does not treat an unchanged duration as a clock edit", () => {
    const current = {
      startsAt: "2026-08-13T00:00:00.000Z",
      endsAt: "2026-08-14T00:00:00.000Z",
    };
    expect(clockFieldsWouldChange(current, { durationMinutes: 1440 })).toBe(false);
    expect(clockFieldsWouldChange(current, { durationMinutes: 60 })).toBe(true);
    expect(clockFieldsWouldChange(current, { title: "THE WALL" } as { durationMinutes?: number })).toBe(
      false,
    );
  });
});
