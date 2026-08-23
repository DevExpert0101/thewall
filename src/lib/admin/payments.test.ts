import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lookupAdminPayment, loadAdminOverview } from "@/lib/admin/data";
import { payloadContainsSecret } from "@/lib/admin/sanitize";
import { formatPublicNumber } from "@/lib/utils";
import { openAutomatedWall, payAndPublish, resetAutomatedWall } from "@/lib/testing/harness";

describe("admin payment ledger", () => {
  beforeEach(() => {
    openAutomatedWall();
  });

  afterEach(() => {
    resetAutomatedWall();
  });

  it("lists simulated $1 publishes and looks them up by number or hash", async () => {
    const mark = payAndPublish("Paid so the steward can see the settlement.");
    const overview = await loadAdminOverview();
    expect(overview.recentPayments).toHaveLength(1);
    expect(overview.recentPayments[0]?.publicNumber).toBe(mark.publicNumber);
    expect(overview.recentPayments[0]?.status).toBe("completed");
    expect(overview.recentPayments[0]?.transactionHash).toBe(mark.paymentId);
    expect(payloadContainsSecret(overview.recentPayments)).toBe(false);

    const byNumber = await lookupAdminPayment(formatPublicNumber(mark.publicNumber));
    expect(byNumber?.transactionHash).toBe(mark.paymentId);
    const byHash = await lookupAdminPayment(mark.paymentId);
    expect(byHash?.publicNumber).toBe(mark.publicNumber);
    expect(await lookupAdminPayment("#000004")).toBeNull();
  });
});
