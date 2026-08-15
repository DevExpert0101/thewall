import { describe, expect, it } from "vitest";
import {
  editionMessagePath,
  editionNumberOf,
  editionPath,
  formatEditionDate,
  formatEditionNumber,
  parseEdition,
} from "@/lib/utils";

describe("edition formatting", () => {
  it("pads official edition numbers", () => {
    expect(formatEditionNumber(1)).toBe("№001");
    expect(formatEditionNumber(12)).toBe("№012");
    expect(parseEdition("001")).toBe(1);
    expect(parseEdition("№002")).toBe(2);
    expect(parseEdition("records")).toBeNull();
    expect(editionPath(1)).toBe("/archive/001");
    expect(editionMessagePath(1, 4291)).toBe("/archive/001/4291");
    expect(editionNumberOf({})).toBe(1);
    expect(formatEditionDate("2026-08-08T00:00:00.000Z")).toBe("AUGUST 8, 2026");
  });
});
