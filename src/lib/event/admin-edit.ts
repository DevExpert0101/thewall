import { AppError, ERROR_CODES } from "@/lib/errors";

export function assertHistoricalTimestampEdit(input: {
  launched: boolean;
  changingWindow: boolean;
  confirmed: boolean;
}): void {
  if (input.launched && input.changingWindow && input.confirmed !== true) {
    throw new AppError(
      ERROR_CODES.CONFIRMATION_REQUIRED,
      "Historical timestamps cannot be changed after launch without explicit confirmation.",
      409,
    );
  }
}
