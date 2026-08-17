import { describe, expect, it } from "vitest";
import {
  PAY_AT_CLOSE_POLICY,
  isUnverifiedArchive,
  publishDecisionAfterPayment,
} from "@/lib/payment/close-policy";

describe("pay-at-close policy", () => {
  it("is explicit: no carve after close, no automatic refund", () => {
    expect(PAY_AT_CLOSE_POLICY.publishesAfterClose).toBe(false);
    expect(PAY_AT_CLOSE_POLICY.refundsAutomatically).toBe(false);
    expect(PAY_AT_CLOSE_POLICY.visitorLine).toMatch(/not published/i);
    expect(PAY_AT_CLOSE_POLICY.visitorLine).toMatch(/does not reverse/i);
    expect(PAY_AT_CLOSE_POLICY.visitorLine).toMatch(/do not pay again/i);
  });

  it("publishes only while the Wall is live", () => {
    expect(publishDecisionAfterPayment("live")).toBe("publish");
    expect(publishDecisionAfterPayment("upcoming")).toBe("paid_after_close");
    expect(publishDecisionAfterPayment("finalizing")).toBe("paid_after_close");
    expect(publishDecisionAfterPayment("archived")).toBe("paid_after_close");
    expect(
      publishDecisionAfterPayment("live", {
        endsAt: "2026-08-15T00:00:00.000Z",
        now: "2026-08-15T00:00:00.400Z",
      }),
    ).toBe("paid_after_close");
    expect(
      publishDecisionAfterPayment("live", {
        endsAt: "2026-08-15T00:00:01.000Z",
        now: "2026-08-15T00:00:00.000Z",
      }),
    ).toBe("publish");
  });

  it("does not treat a missing seal as a verified archive", () => {
    expect(isUnverifiedArchive({ archiveHash: null, merkleRoot: null })).toBe(true);
    expect(isUnverifiedArchive({ archiveHash: "aa", merkleRoot: null })).toBe(true);
    expect(isUnverifiedArchive({ archiveHash: "aa", merkleRoot: "bb" })).toBe(false);
  });
});
