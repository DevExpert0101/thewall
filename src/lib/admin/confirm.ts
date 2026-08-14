import { AppError, ERROR_CODES } from "@/lib/errors";
import { formatPublicNumber, parsePublicNumber } from "@/lib/utils";

export type DangerousAdminAction = "remove" | "restore" | "dismiss";

export function expectedConfirmPhrase(action: DangerousAdminAction): string {
  if (action === "remove") return "REMOVE";
  if (action === "restore") return "RESTORE";
  return "DISMISS";
}

export function confirmTextMatches(input: {
  confirmText: string;
  action: DangerousAdminAction;
  publicNumber?: number | null;
}): boolean {
  const raw = input.confirmText.trim();
  if (!raw) return false;
  if (raw.toUpperCase() === expectedConfirmPhrase(input.action)) return true;
  if (input.publicNumber == null) return false;
  const parsed = parsePublicNumber(raw);
  return parsed === input.publicNumber || raw === formatPublicNumber(input.publicNumber);
}

export function assertDangerousConfirm(input: {
  confirm: boolean;
  confirmText: string;
  action: DangerousAdminAction;
  publicNumber?: number | null;
}): void {
  if (input.confirm !== true || !confirmTextMatches(input)) {
    throw new AppError(
      ERROR_CODES.CONFIRMATION_REQUIRED,
      "Type the confirmation phrase to continue.",
      409,
    );
  }
}
