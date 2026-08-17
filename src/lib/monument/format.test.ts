import { describe, expect, it } from "vitest";
import {
  formatInscriptionMark,
  formatMonumentEntryMark,
  formatMonumentNumber,
  formatVictorOfWall,
  monumentCapacityLine,
  parseMonumentNumber,
} from "@/lib/monument/format";
import { monumentPath } from "@/lib/utils";

describe("Monument format", () => {
  it("formats sequential Monument numbers", () => {
    expect(formatMonumentNumber(1)).toBe("M-0001");
    expect(formatMonumentNumber(7)).toBe("M-0007");
    expect(formatMonumentEntryMark(7)).toBe("MONUMENT ENTRY M-0007");
    expect(formatInscriptionMark(4291)).toBe("INSCRIPTION #004291");
    expect(formatVictorOfWall(7)).toBe("Victor of The Wall №007");
    expect(monumentPath(7)).toBe("/monument/7");
  });

  it("parses public Monument numbers", () => {
    expect(parseMonumentNumber("7")).toBe(7);
    expect(parseMonumentNumber("M-0007")).toBe(7);
    expect(parseMonumentNumber("m7")).toBe(7);
    expect(parseMonumentNumber("0")).toBeNull();
    expect(parseMonumentNumber("abc")).toBeNull();
  });

  it("hides capacity unless configured", () => {
    expect(monumentCapacityLine(7, null)).toBeNull();
    expect(monumentCapacityLine(7, 1000)).toBe("7 OF 1000 POSITIONS SEALED");
  });
});
