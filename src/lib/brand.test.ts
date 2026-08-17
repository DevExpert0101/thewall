import { describe, expect, it } from "vitest";
import { BRAND } from "@/lib/brand";
import {
  formatMessageMark,
  formatObjectIdentity,
  formatShareIdentity,
  formatWallEdition,
  formatWallPlace,
} from "@/lib/utils";

describe("brand terms", () => {
  it("keeps the canonical visitor names", () => {
    expect(BRAND.name).toBe("The Wall");
    expect(BRAND.wordmark).toBe("THE WALL");
    expect(BRAND.message).toBe("Message");
    expect(BRAND.inscription).toBe("Inscription");
    expect(BRAND.victor).toBe("The Victor");
    expect(BRAND.monument).toBe("The Monument");
    expect(BRAND.wallKey).toBe("Wall Key");
    expect(BRAND.wallKeyYours).toBe("YOUR WALL KEY");
    expect(BRAND.ownershipReceipt).toBe("Ownership Receipt");
    expect(BRAND.certificate).toBe("Certificate");
    expect(BRAND.archive).toBe("Archive");
    expect(BRAND.recordBook).toBe("Record Book");
    expect(BRAND.leaveYourMark).toBe("Leave your mark");
    expect(BRAND.closed).toBe("The Wall has closed");
    expect(BRAND.sorts.rising).toBe("Rising");
    expect(BRAND.sorts.hot).toBe("Most 🔥");
    expect(BRAND.sorts.random).toBe("Random");
  });

  it("formats identities with those names", () => {
    expect(formatWallEdition(1)).toBe("THE WALL №001");
    expect(formatWallPlace(1)).toBe("The Wall №001");
    expect(formatMessageMark(4291)).toBe("MESSAGE #004291");
    expect(formatObjectIdentity(4291, 1)).toBe("THE WALL №001 / MESSAGE #004291");
    expect(formatShareIdentity(4291, 1)).toBe("Message #004291 on The Wall №001");
  });
});
