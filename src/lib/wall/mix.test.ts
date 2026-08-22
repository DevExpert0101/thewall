import { describe, expect, it } from "vitest";
import { ARCHIVAL_REMOVAL_TEXT } from "@/lib/constants";
import type { PublicMessage } from "@/lib/types";
import {
  pickSpectatorWander,
  spectatorHourSalt,
  spectatorRankLabel,
  weaveSpectatorFeed,
} from "@/lib/wall/mix";

function msg(
  n: number,
  extra: Partial<PublicMessage> = {},
): PublicMessage {
  return {
    id: `m-${n}`,
    eventId: "local",
    publicNumber: n,
    text: extra.text ?? `Sentence ${n} on the wall.`,
    isRemoved: false,
    reactionCount: n,
    publishedAt: "2026-08-16T12:00:00.000Z",
    finalRank: null,
    ...extra,
  };
}

describe("weaveSpectatorFeed", () => {
  it("interleaves public lanes and never invents a sentence", () => {
    const woven = weaveSpectatorFeed({
      rising: [msg(15), msg(17), msg(13)],
      fresh: [msg(18), msg(16)],
      quiet: [msg(11)],
      surprise: [msg(3), msg(7)],
    });
    expect(woven.map((row) => row.publicNumber)).toEqual([15, 18, 3, 17, 11, 13, 16, 7]);
    expect(woven.map((row) => row.lane)).toEqual([
      "rising",
      "fresh",
      "surprise",
      "rising",
      "quiet",
      "rising",
      "fresh",
      "surprise",
    ]);
    expect(woven.every((row) => row.text.startsWith("Sentence"))).toBe(true);
  });

  it("drops removed rows and duplicate numbers across lanes", () => {
    const woven = weaveSpectatorFeed({
      rising: [
        msg(15),
        msg(8, { text: ARCHIVAL_REMOVAL_TEXT, isRemoved: true }),
      ],
      fresh: [msg(15), msg(18)],
      quiet: [msg(8, { text: ARCHIVAL_REMOVAL_TEXT, isRemoved: true })],
      surprise: [msg(18), msg(2)],
    });
    expect(woven.map((row) => row.publicNumber)).toEqual([15, 18, 2]);
    expect(woven.some((row) => row.isRemoved)).toBe(false);
  });

  it("does not pick a lane by reading the sentence", () => {
    const funny = msg(1, { text: "The bus was late. I got the job anyway." });
    const heavy = msg(2, { text: "Dad, I made it to Tuesday. That's all I had in me." });
    const first = weaveSpectatorFeed({
      rising: [funny],
      fresh: [heavy],
      quiet: [],
      surprise: [],
    });
    const swapped = weaveSpectatorFeed({
      rising: [heavy],
      fresh: [funny],
      quiet: [],
      surprise: [],
    });
    expect(first[0]?.lane).toBe("rising");
    expect(first[0]?.text).toBe(funny.text);
    expect(swapped[0]?.text).toBe(heavy.text);
    expect(swapped[0]?.lane).toBe("rising");
  });

  it("skips empty lanes instead of leaving holes", () => {
    const woven = weaveSpectatorFeed({
      rising: [msg(4), msg(5)],
      fresh: [],
      quiet: [],
      surprise: [msg(9)],
    });
    expect(woven.map((row) => `${row.lane}:${row.publicNumber}`)).toEqual([
      "rising:4",
      "surprise:9",
      "rising:5",
    ]);
  });
});

describe("spectator wander salt", () => {
  it("is the same for every visitor in the same hour", () => {
    const salt = spectatorHourSalt("local", Date.parse("2026-08-16T20:17:00.000Z"));
    expect(salt).toBe(spectatorHourSalt("local", Date.parse("2026-08-16T20:44:00.000Z")));
    expect(pickSpectatorWander({ maxNumber: 18, count: 4, salt })).toEqual(
      pickSpectatorWander({ maxNumber: 18, count: 4, salt }),
    );
  });

  it("freezes to the close hour so a sealed wall does not drift", () => {
    expect(
      spectatorHourSalt("local", Date.parse("2026-08-17T04:00:00.000Z"), true, "2026-08-16T22:00:00.000Z"),
    ).toBe(spectatorHourSalt("local", Date.parse("2026-08-18T11:00:00.000Z"), true, "2026-08-16T22:00:00.000Z"));
  });

  it("labels lanes without inventing a mood", () => {
    expect(spectatorRankLabel("surprise", "rising", 2, false)).toBe("Wander");
    expect(spectatorRankLabel("fresh", "rising", 0, false)).toBe("Just in");
    expect(spectatorRankLabel("quiet", "rising", 4, false)).toBe("Quiet");
    expect(spectatorRankLabel("rising", "rising", 0, false)).toBe("Rising");
    expect(spectatorRankLabel("rising", "rising", 0, true)).toBe("Just arrived");
  });
});
