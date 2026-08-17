import { AppError, ERROR_CODES } from "@/lib/errors";
import { publishDecisionAfterPayment } from "@/lib/payment/close-policy";
import type { EventPhase } from "@/lib/event/state";

export type RecoveredPublication = {
  publicNumber: number;
  messageId: string;
  publishedAt: string;
  recovered: true;
};

export function paidAfterCloseError(): AppError {
  return new AppError(
    ERROR_CODES.PAID_AFTER_CLOSE,
    "The Wall closed during checkout.",
    409,
  );
}

export function decideVerifiedPayment(phase: EventPhase): "publish" {
  if (publishDecisionAfterPayment(phase) === "publish") return "publish";
  throw paidAfterCloseError();
}
