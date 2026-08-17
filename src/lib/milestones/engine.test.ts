import { describe, expect, it } from "vitest";
import {
  crossedMilestones,
  hasReachedMilestone,
  milestoneChorus,
  milestoneHeadline,
  parseMilestoneQuery,
  rarestCelebration,
  reachedMilestones,
} from "@/lib/milestones/engine";

describe("milestone engine", () => {
  it("only lists marks the verified totals have actually reached", () => {
    expect(reachedMilestones({ messages: 18, reactions: 401 }).map((row) => row.id)).toEqual([
      "message:1",
      "message:10",
    ]);
    expect(reachedMilestones({ messages: 0, reactions: 0 })).toEqual([]);
    expect(reachedMilestones({ messages: 9_999, reactions: 9_999 }).map((row) => row.id)).toEqual([
      "message:1",
      "message:10",
      "message:100",
      "message:1000",
    ]);
    expect(hasReachedMilestone({ messages: 10_000, reactions: 0 }, parseMilestoneQuery({ mark: "10000" })!)).toBe(
      true,
    );
    expect(hasReachedMilestone({ messages: 9_999, reactions: 0 }, parseMilestoneQuery({ mark: "10000" })!)).toBe(
      false,
    );
  });

  it("does not invent a crossing from optimistic or backward counts", () => {
    expect(crossedMilestones({ messages: 18, reactions: 40 }, { messages: 18, reactions: 40 })).toEqual([]);
    expect(crossedMilestones({ messages: 10_000, reactions: 40 }, { messages: 9_000, reactions: 40 })).toEqual([]);
    expect(crossedMilestones({ messages: 9_999, reactions: 40 }, { messages: 10_005, reactions: 40 }).map((row) => row.id)).toEqual(
      ["message:10000"],
    );
  });

  it("celebrates only the rarest new mark so a burst does not stack", () => {
    const burst = rarestCelebration({ messages: 0, reactions: 0 }, { messages: 10_000, reactions: 10_000 });
    expect(burst?.id).toBe("message:10000");
    expect(rarestCelebration({ messages: 18, reactions: 40 }, { messages: 18, reactions: 40 })).toBeNull();
    expect(rarestCelebration({ messages: 9, reactions: 40 }, { messages: 10, reactions: 40 })).toBeNull();
    expect(rarestCelebration({ messages: 0, reactions: 9_999 }, { messages: 0, reactions: 10_000 })?.id).toBe(
      "fire:10000",
    );
  });

  it("refuses unknown or combined query marks", () => {
    expect(parseMilestoneQuery({ mark: "10000" })?.id).toBe("message:10000");
    expect(parseMilestoneQuery({ fire: "1000000" })?.id).toBe("fire:1000000");
    expect(parseMilestoneQuery({ mark: "7" })).toBeNull();
    expect(parseMilestoneQuery({ mark: "10000", fire: "10000" })).toBeNull();
    expect(milestoneHeadline(parseMilestoneQuery({ mark: "1" })!)).toBe("MESSAGE #000001");
    expect(milestoneChorus(parseMilestoneQuery({ mark: "10000" })!)).toBe("10,000 PEOPLE HAVE SPOKEN.");
    expect(milestoneHeadline(parseMilestoneQuery({ fire: "1000000" })!)).toBe("1,000,000 🔥");
  });
});
