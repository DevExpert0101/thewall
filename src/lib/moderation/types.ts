export type ModerationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "flagged"
  | "removed";

/** Public decision shown to the composer. Never includes rule detail. */
export type ModerationDecision = "allowed" | "review_required" | "rejected";

export type ModerationResult = {
  status: ModerationStatus;
  decision: ModerationDecision;
  reasonCode: string | null;
  provider: string;
};

export interface ModerationProvider {
  readonly name: string;
  review(input: { text: string }): Promise<ModerationResult>;
}

export function decisionFromStatus(status: ModerationStatus): ModerationDecision {
  if (status === "rejected" || status === "removed") return "rejected";
  if (status === "flagged" || status === "pending") return "review_required";
  return "allowed";
}

/** Rejected text must not open a wallet. Review-required may pay and is queued. */
export function canProceedToPayment(result: ModerationResult): boolean {
  const decision = result.decision ?? decisionFromStatus(result.status);
  return decision === "allowed" || decision === "review_required";
}
