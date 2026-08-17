import { describe, expect, it } from "vitest";
import {
  editionManifestPath,
  editionMessagePath,
  editionNumberOf,
  editionPath,
  editionVerifyPath,
  formatEditionDate,
  formatEditionMonth,
  formatPublicDate,
  formatEditionNumber,
  formatMessageMark,
  formatObjectIdentity,
  formatWallEdition,
  formatShareIdentity,
  formatWallPlace,
  formatWallShort,
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
    expect(editionVerifyPath(1)).toBe("/archive/001/verify");
    expect(editionManifestPath(1)).toBe("/archive/001/manifest");
    expect(editionMessagePath(1, 4291)).toBe("/archive/001/4291");
    expect(editionNumberOf({})).toBe(1);
    expect(formatEditionDate("2026-08-08T00:00:00.000Z")).toBe("AUGUST 8, 2026");
    expect(formatEditionMonth("2026-08-08T00:00:00.000Z")).toBe("August 2026");
    expect(formatPublicDate("2026-08-09T00:00:00.000Z")).toBe("August 9, 2026");
    expect(formatWallEdition(1)).toBe("THE WALL №001");
    expect(formatMessageMark(4291)).toBe("MESSAGE #004291");
    expect(formatObjectIdentity(4291, 1)).toBe("THE WALL №001 / MESSAGE #004291");
    expect(formatWallPlace(1)).toBe("The Wall №001");
    expect(formatShareIdentity(4291, 1)).toBe("Message #004291 on The Wall №001");
    expect(formatWallShort(1)).toBe("WALL №001");
  });
});
