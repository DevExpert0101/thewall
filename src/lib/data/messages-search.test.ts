import { describe, expect, it } from "vitest";
import { searchPublicMessages } from "@/lib/data/messages";

describe("public message search", () => {
  it("finds a sentence by words as well as by number", async () => {
    const byWords = await searchPublicMessages("local", "fifty years");
    expect(byWords.some((message) => message.publicNumber === 4)).toBe(true);
    expect(byWords[0]?.text).toMatch(/fifty years/i);

    const byNumber = await searchPublicMessages("local", "#000004");
    expect(byNumber).toHaveLength(1);
    expect(byNumber[0]?.publicNumber).toBe(4);

    const miss = await searchPublicMessages("local", "no such inscription exists here");
    expect(miss).toEqual([]);

    const tooShort = await searchPublicMessages("local", "ab");
    expect(tooShort).toEqual([]);
  });
});
