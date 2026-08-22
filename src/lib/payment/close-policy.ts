import type { EventPhase } from "@/lib/event/state";

/**
 * Pay-at-close policy — source of truth.
 *
 * A verified $1 publishes only while the Wall is still LIVE at the moment
 * the server checks the payment. Clock expiry stops carving. The on-chain
 * transfer is not reversed. The visitor is told this happened, must not pay
 * again, and is not promised a refund.
 *
 * This is not a silent drop: verify returns PAID_AFTER_CLOSE.
 */
export const PAY_AT_CLOSE_POLICY = {
  id: "pay-at-close-v1",
  publishesAfterClose: false,
  refundsAutomatically: false,
  visitorLine:
    "If the clock has already reached zero when the payment is checked, the sentence is not published. This page does not reverse an on-chain transfer. If payment was received and the sentence still could not be published, the site says so — do not pay again; contact support with your receipt.",
} as const;

export type PublishAfterPayment = "publish" | "paid_after_close";

export function publishDecisionAfterPayment(
  phase: EventPhase,
  clock?: { endsAt: string; now?: Date | string | number },
): PublishAfterPayment {
  if (clock) {
    const nowMs =
      clock.now === undefined
        ? Date.now()
        : typeof clock.now === "number"
          ? clock.now
          : new Date(clock.now).getTime();
    if (new Date(clock.endsAt).getTime() <= nowMs) return "paid_after_close";
  }
  return phase === "live" ? "publish" : "paid_after_close";
}

export function isUnverifiedArchive(input: {
  archiveHash?: string | null;
  merkleRoot?: string | null;
}): boolean {
  return !input.archiveHash || !input.merkleRoot;
}
