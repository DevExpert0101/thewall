import { describe, expect, it } from "vitest";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { assertHistoricalTimestampEdit } from "@/lib/event/admin-edit";

describe("historical event timestamps", () => {
  it("blocks post-launch window edits without confirmation", () => {
    expect(() =>
      assertHistoricalTimestampEdit({
        launched: true,
        changingWindow: true,
        confirmed: false,
      }),
    ).toThrow(AppError);
    try {
      assertHistoricalTimestampEdit({
        launched: true,
        changingWindow: true,
        confirmed: false,
      });
    } catch (error) {
      expect((error as AppError).code).toBe(ERROR_CODES.CONFIRMATION_REQUIRED);
      expect((error as AppError).status).toBe(409);
    }
  });

  it("allows confirmed edits and pre-launch changes", () => {
    expect(() =>
      assertHistoricalTimestampEdit({
        launched: true,
        changingWindow: true,
        confirmed: true,
      }),
    ).not.toThrow();
    expect(() =>
      assertHistoricalTimestampEdit({
        launched: false,
        changingWindow: true,
        confirmed: false,
      }),
    ).not.toThrow();
  });
});
