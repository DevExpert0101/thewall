import { describe, expect, it } from "vitest";
import {
  FIRST_HUNDRED_LINE,
  FIRST_VOICES,
  JUST_OPENED_TITLE,
  WAITING_ROOM_TITLE,
  firstHundredLine,
  launchCopy,
  launchMoment,
  nextUnreachedMessageMark,
} from "@/lib/launch/cold-start";

describe("cold start", () => {
  it("treats upcoming as a waiting room with a real opening time", () => {
    const copy = launchCopy({
      phase: "upcoming",
      startsAt: "2026-08-16T18:00:00.000Z",
      totalMessages: 0,
    });
    expect(launchMoment({ phase: "upcoming", totalMessages: 0 })).toBe("waiting");
    expect(copy.title).toBe(WAITING_ROOM_TITLE);
    expect(copy.kicker).toMatch(/opens august 16, 2026/i);
    expect(copy.body).toMatch(/no sentences/i);
    expect(copy.body).not.toMatch(/1,000|viral|viewers/i);
  });

  it("turns a blank live wall into truthful first-hundred scarcity", () => {
    const copy = launchCopy({
      phase: "live",
      startsAt: "2026-08-16T18:00:00.000Z",
      totalMessages: 0,
    });
    expect(copy.title).toBe(JUST_OPENED_TITLE);
    expect(copy.body).toBe(FIRST_HUNDRED_LINE);
    expect(copy.body).toContain(String(FIRST_VOICES));
  });

  it("uses the real voice count while the first hundred is still open", () => {
    expect(firstHundredLine(12)).toBe("12 voices so far. 88 seats remain in the first hundred.");
    expect(launchMoment({ phase: "live", totalMessages: 12 })).toBe("just_opened");
    expect(launchMoment({ phase: "live", totalMessages: 100 })).toBe("open");
    expect(nextUnreachedMessageMark(12)).toBe(100);
    expect(nextUnreachedMessageMark(0)).toBe(1);
  });

  it("never invents messages, reactions, or viewers", () => {
    const invited = launchCopy(
      { phase: "upcoming", startsAt: "2026-08-16T18:00:00.000Z", totalMessages: 0 },
      true,
    );
    expect(invited.body).toMatch(/invited/i);
    const packed = JSON.stringify([
      launchCopy({ phase: "live", startsAt: "2026-08-16T18:00:00.000Z", totalMessages: 0 }),
      firstHundredLine(0),
    ]);
    expect(packed).not.toMatch(/viewers|watching now|fake|seeded/i);
  });
});
