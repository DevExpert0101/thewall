import { AppError, ERROR_CODES } from "@/lib/errors";
import { validateMessage } from "@/lib/message/normalize";
import { evaluateModeration } from "@/lib/moderation/rules";
import { canProceedToPayment, type ModerationDecision, type ModerationStatus } from "@/lib/moderation/types";

export type PublishPreflight = {
  text: string;
  moderationStatus: ModerationStatus;
  decision: ModerationDecision;
};

export function rejectBeforePayment(): never {
  throw new AppError(
    ERROR_CODES.MODERATION_REJECTED,
    "This sentence cannot be published.",
    422,
  );
}

/** Validate + moderate. Safe to call from simulation without a database. */
export function assertCanCharge(raw: string): PublishPreflight {
  const text = validateMessage(raw);
  const moderation = evaluateModeration(text);
  if (!canProceedToPayment(moderation)) {
    rejectBeforePayment();
  }
  return {
    text,
    moderationStatus: moderation.status,
    decision: moderation.decision,
  };
}
