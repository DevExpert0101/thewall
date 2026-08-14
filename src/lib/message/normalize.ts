import { AppError, ERROR_CODES } from "@/lib/errors";
import { MESSAGE_DB_MAX_CHARS, MESSAGE_MAX_GRAPHEMES } from "@/lib/constants";

const CONTROL_AND_BIDI =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B\u200C\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g;

function graphemeCount(text: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    return [...segmenter.segment(text)].length;
  }
  return [...text].length;
}

export function normalizeMessage(input: string): string {
  const nfc = input.normalize("NFC");
  const stripped = nfc.replace(CONTROL_AND_BIDI, "");
  return stripped.trim();
}

export function validateMessage(input: string): string {
  if (typeof input !== "string") {
    throw new AppError(ERROR_CODES.VALIDATION, "Message is required.");
  }
  const text = normalizeMessage(input);
  if (!text) {
    throw new AppError(ERROR_CODES.VALIDATION, "Message cannot be empty.");
  }
  if (graphemeCount(text) > MESSAGE_MAX_GRAPHEMES) {
    throw new AppError(
      ERROR_CODES.VALIDATION,
      `Message must be ${MESSAGE_MAX_GRAPHEMES} characters or fewer.`,
    );
  }
  if (text.length > MESSAGE_DB_MAX_CHARS) {
    throw new AppError(ERROR_CODES.VALIDATION, "Message is too long.");
  }
  return text;
}

export { graphemeCount };
