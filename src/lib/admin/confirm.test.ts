import { describe, expect, it } from "vitest";
import { assertDangerousConfirm, confirmTextMatches, expectedConfirmPhrase } from "@/lib/admin/confirm";
import { ERROR_CODES } from "@/lib/errors";

describe("dangerous confirmation", () => {
  it("requires the phrase or the public number", () => {
    expect(expectedConfirmPhrase("remove")).toBe("REMOVE");
    expect(confirmTextMatches({ confirmText: "REMOVE", action: "remove", publicNumber: 12 })).toBe(true);
    expect(confirmTextMatches({ confirmText: "#000012", action: "remove", publicNumber: 12 })).toBe(true);
    expect(confirmTextMatches({ confirmText: "12", action: "remove", publicNumber: 12 })).toBe(true);
    expect(confirmTextMatches({ confirmText: "yes", action: "remove", publicNumber: 12 })).toBe(false);
    expect(confirmTextMatches({ confirmText: "REMOVE", action: "restore", publicNumber: 12 })).toBe(false);
    expect(expectedConfirmPhrase("finish")).toBe("FINISH");
    expect(confirmTextMatches({ confirmText: "FINISH", action: "finish" })).toBe(true);
    expect(confirmTextMatches({ confirmText: "yes", action: "finish" })).toBe(false);
    expect(expectedConfirmPhrase("ops")).toBe("OPS");
    expect(confirmTextMatches({ confirmText: "OPS", action: "ops" })).toBe(true);
    expect(confirmTextMatches({ confirmText: "CLOCK", action: "ops" })).toBe(false);
  });

  it("rejects unconfirmed destructive work", () => {
    try {
      assertDangerousConfirm({
        confirm: false,
        confirmText: "REMOVE",
        action: "remove",
        publicNumber: 1,
      });
      throw new Error("expected throw");
    } catch (error) {
      expect((error as { code: string }).code).toBe(ERROR_CODES.CONFIRMATION_REQUIRED);
    }
  });
});
