export type ModerationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "flagged"
  | "removed";

export type ModerationResult = {
  status: ModerationStatus;
  reasonCode: string | null;
  provider: string;
};

export interface ModerationProvider {
  readonly name: string;
  review(input: { text: string }): Promise<ModerationResult>;
}

export function canProceedToPayment(result: ModerationResult): boolean {
  return result.status === "approved" || result.status === "flagged";
}
