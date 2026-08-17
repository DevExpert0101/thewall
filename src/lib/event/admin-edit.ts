import { AppError, ERROR_CODES } from "@/lib/errors";
import { CLOCK_CONFIRM_PHRASE } from "@/lib/ops/controls";

export function clockFieldsWouldChange(
  current: { startsAt: string; endsAt: string },
  input: {
    startsAt?: string;
    endsAt?: string;
    remainingMinutes?: number;
    durationMinutes?: number;
  },
  now = Date.now(),
): boolean {
  if (input.startsAt && Date.parse(input.startsAt) !== Date.parse(current.startsAt)) {
    return true;
  }
  if (input.endsAt && Date.parse(input.endsAt) !== Date.parse(current.endsAt)) {
    return true;
  }
  if (input.remainingMinutes != null) {
    const nextEnds = now + input.remainingMinutes * 60_000;
    if (Math.abs(nextEnds - Date.parse(current.endsAt)) > 30_000) return true;
  }
  if (input.durationMinutes != null) {
    const currentWindow = Math.round(
      (Date.parse(current.endsAt) - Date.parse(current.startsAt)) / 60_000,
    );
    if (input.durationMinutes !== currentWindow) return true;
  }
  return false;
}

export function assertHistoricalTimestampEdit(input: {
  launched: boolean;
  changingWindow: boolean;
  confirmed: boolean;
  confirmText?: string;
}): void {
  if (!input.launched || !input.changingWindow) return;
  const typed = (input.confirmText ?? "").trim().toUpperCase() === CLOCK_CONFIRM_PHRASE;
  if (input.confirmed !== true || !typed) {
    throw new AppError(
      ERROR_CODES.CONFIRMATION_REQUIRED,
      "Type CLOCK to change the event deadline after launch.",
      409,
    );
  }
}
