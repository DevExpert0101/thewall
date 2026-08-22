import { describe, expect, it } from "vitest";
import { ARCHIVAL_REMOVAL_TEXT } from "@/lib/constants";
import type { PublicMessage } from "@/lib/types";
import { selectWitnessSentences } from "@/lib/wall/witness";

function msg(extra: Partial<PublicMessage> & Pick<PublicMessage, "publicNumber" | "text">): PublicMessage {
  return {
    id: `m-${extra.publicNumber}`,
    eventId: "local",
    isRemoved: false,
    reactionCount: 0,
    publishedAt: "2026-08-16T12:00:00.000Z",
    finalRank: null,
    ...extra,
  };
}

describe("selectWitnessSentences", () => {
  it("drops removed rows and never invents a sentence", () => {
    const picked = selectWitnessSentences([
      msg({ publicNumber: 8, text: ARCHIVAL_REMOVAL_TEXT, isRemoved: true, reactionCount: 99 }),
      msg({
        publicNumber: 4,
        text: "If you are reading this in fifty years, I drove a night bus and I liked the quiet.",
        reactionCount: 67,
      }),
    ]);
    expect(picked.map((row) => row.publicNumber)).toEqual([4]);
    expect(picked.some((row) => row.text === ARCHIVAL_REMOVAL_TEXT)).toBe(false);
  });

  it("ignores fragments too short to read as a sentence", () => {
    const picked = selectWitnessSentences([
      msg({ publicNumber: 1, text: "ok", reactionCount: 40 }),
      msg({
        publicNumber: 2,
        text: "Sold the guitar in March. I still reach for it when a song comes on.",
        reactionCount: 18,
      }),
    ]);
    expect(picked.map((row) => row.publicNumber)).toEqual([2]);
  });

  it("prefers fire, then the earlier carve, and caps the list", () => {
    const picked = selectWitnessSentences(
      [
        msg({
          publicNumber: 3,
          text: "I told her I was fine. I was sitting in the parking lot.",
          reactionCount: 9,
          publishedAt: "2026-08-16T10:00:00.000Z",
        }),
        msg({
          publicNumber: 1,
          text: "Dad, I made it to Tuesday. That's all I had in me.",
          reactionCount: 41,
          publishedAt: "2026-08-16T09:00:00.000Z",
        }),
        msg({
          publicNumber: 9,
          text: "I still have your hoodie. I wear it to take the trash out.",
          reactionCount: 41,
          publishedAt: "2026-08-16T11:00:00.000Z",
        }),
        msg({
          publicNumber: 5,
          text: "Sorry I missed your birthday. I was on the phone with the hospital.",
          reactionCount: 12,
        }),
        msg({
          publicNumber: 6,
          text: "Asked my boss for Friday off. Said dentist. It was a funeral.",
          reactionCount: 23,
        }),
      ],
      3,
    );
    expect(picked.map((row) => row.publicNumber)).toEqual([1, 9, 6]);
  });
});
