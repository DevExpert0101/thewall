import { describe, expect, it } from "vitest";
import {
  resolveSimulatedCloseCookie,
  simulatedCloseCookieValue,
} from "@/lib/data/simulation-session";

describe("simulated close cookie", () => {
  const startsAt = "2026-08-22T12:00:00.000Z";

  it("seals only the wall that wrote the cookie", () => {
    expect(
      resolveSimulatedCloseCookie(simulatedCloseCookieValue(startsAt), {
        startsAt,
        phase: "live",
      }),
    ).toBe("apply");
  });

  it("drops a leftover close cookie after a new day starts", () => {
    expect(
      resolveSimulatedCloseCookie("1", { startsAt, phase: "live" }),
    ).toBe("drop");
    expect(
      resolveSimulatedCloseCookie(simulatedCloseCookieValue("2026-08-16T12:00:00.000Z"), {
        startsAt,
        phase: "live",
      }),
    ).toBe("drop");
  });

  it("does not invent a close when no cookie is present", () => {
    expect(resolveSimulatedCloseCookie(undefined, { startsAt, phase: "live" })).toBe("ignore");
  });
});
