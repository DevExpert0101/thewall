import { describe, expect, it } from "vitest";
import { AppError, ERROR_CODES, asAppError, publicErrorPayload } from "@/lib/errors";

describe("public error payload", () => {
  it("maps a real AppError", () => {
    const payload = publicErrorPayload(
      new AppError(ERROR_CODES.EVENT_ENDED, "The Wall has closed.", 403),
    );
    expect(payload.code).toBe(ERROR_CODES.EVENT_ENDED);
    expect(payload.status).toBe(403);
    expect(payload.error).toMatch(/closed/i);
  });

  it("maps a duplicated AppError-shaped throw from another bundle", () => {
    const foreign = Object.assign(new Error("The Wall has closed."), {
      name: "AppError",
      code: ERROR_CODES.EVENT_ENDED,
      status: 403,
      recovery: "The Wall has closed. You can still read every message in the Archive.",
    });
    expect(foreign instanceof AppError).toBe(false);
    expect(asAppError(foreign)?.code).toBe(ERROR_CODES.EVENT_ENDED);
    const payload = publicErrorPayload(foreign);
    expect(payload.code).toBe(ERROR_CODES.EVENT_ENDED);
    expect(payload.status).toBe(403);
    expect(payload.error).not.toBe("Something went wrong.");
  });

  it("does not treat a bare Error as a closed wall", () => {
    const payload = publicErrorPayload(new Error("boom"));
    expect(payload.code).toBe(ERROR_CODES.UNAVAILABLE);
    expect(payload.status).toBe(500);
    expect(payload.error).toBe("Something went wrong.");
  });
});
