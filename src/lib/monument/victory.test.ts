import { describe, expect, it } from "vitest";
import { sampleMonumentEntry } from "@/lib/monument/sample";
import { optionalOwnershipStatement, proofOfVictoryText } from "@/lib/monument/victory";

describe("Proof of Victory", () => {
  it("names the Monument, Wall, and original inscription without an owner", () => {
    const text = proofOfVictoryText(sampleMonumentEntry());
    expect(text).toMatch(/THE MONUMENT/);
    expect(text).toMatch(/PROOF OF VICTORY/);
    expect(text).toMatch(/M-0007/);
    expect(text).toMatch(/WALL OF HOPE/);
    expect(text).toMatch(/INSCRIPTION #004291/);
    expect(text).toMatch(/428,193 inscriptions competed/);
    expect(text).toMatch(/The Monument remains anonymous/);
    expect(text).not.toMatch(/wallet|0x|wall key|email|owner/i);
  });

  it("keeps the optional ownership statement private to the holder", () => {
    const text = optionalOwnershipStatement(sampleMonumentEntry());
    expect(text).toMatch(/I wrote M-0007/);
    expect(text).toMatch(/Victor of The Wall №007/);
    expect(text).not.toMatch(/wallet|0x|wall key/i);
  });
});
