import { ZodError } from "zod";
import { redactSensitiveText } from "@/lib/abuse/redact";

export const ERROR_CODES = {
  EVENT_UPCOMING: "EVENT_UPCOMING",
  EVENT_ENDED: "EVENT_ENDED",
  EVENT_NOT_LIVE: "EVENT_NOT_LIVE",
  VALIDATION: "VALIDATION",
  TURNSTILE: "TURNSTILE",
  MODERATION_REJECTED: "MODERATION_REJECTED",
  MODERATION_UNPUBLISHABLE: "MODERATION_UNPUBLISHABLE",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  RATE_LIMITED: "RATE_LIMITED",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  PAYMENT_CANCELED: "PAYMENT_CANCELED",
  PAYMENT_INCOMPLETE: "PAYMENT_INCOMPLETE",
  WRONG_AMOUNT: "WRONG_AMOUNT",
  WRONG_RECIPIENT: "WRONG_RECIPIENT",
  WRONG_NETWORK: "WRONG_NETWORK",
  TX_ALREADY_USED: "TX_ALREADY_USED",
  HASH_MISMATCH: "HASH_MISMATCH",
  INTENT_EXPIRED: "INTENT_EXPIRED",
  INTENT_FULFILLED: "INTENT_FULFILLED",
  INTENT_NOT_FOUND: "INTENT_NOT_FOUND",
  PAID_AFTER_CLOSE: "PAID_AFTER_CLOSE",
  ARCHIVE_SEAL_FAILED: "ARCHIVE_SEAL_FAILED",
  DUPLICATE_REACTION: "DUPLICATE_REACTION",
  MESSAGE_NOT_FOUND: "MESSAGE_NOT_FOUND",
  CERTIFICATE_INVALID: "CERTIFICATE_INVALID",
  CLAIM_INVALID: "CLAIM_INVALID",
  CLAIM_NOT_WINNER: "CLAIM_NOT_WINNER",
  CLAIM_LOCKED: "CLAIM_LOCKED",
  CLAIM_CHALLENGE: "CLAIM_CHALLENGE",
  FORBIDDEN: "FORBIDDEN",
  CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
  UNAVAILABLE: "UNAVAILABLE",
  INSUFFICIENT_USDC: "INSUFFICIENT_USDC",
  CONFIG: "CONFIG",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const RECOVERY: Record<ErrorCode, string> = {
  EVENT_UPCOMING: "The Wall has not opened yet. Come back when the countdown reaches zero.",
  EVENT_ENDED: "The Wall has closed. You can still read every message in the Archive.",
  EVENT_NOT_LIVE: "Publishing is only possible while The Wall is live.",
  VALIDATION: "Check your message and try again.",
  TURNSTILE:
    "Please complete the verification challenge and try again. You can keep reading the wall either way.",
  MODERATION_REJECTED:
    "This sentence cannot be published. Please revise it. You have not been charged.",
  MODERATION_UNPUBLISHABLE:
    "Payment was received. This sentence was not published. Do not pay again. Contact support with your receipt.",
  UNAUTHENTICATED:
    "Refresh the page to start a new anonymous session. Reading the wall does not require one.",
  RATE_LIMITED: "You are moving too fast. Wait a moment, then try again.",
  PAYMENT_PENDING:
    "Your $1 is still confirming. Keep this page open, or come back and confirm this payment. Do not pay again.",
  PAYMENT_FAILED: "The payment did not finish. The sentence is not on The Wall. No money was taken.",
  PAYMENT_CANCELED: "You canceled the payment. The sentence is not on The Wall. No money was taken.",
  PAYMENT_INCOMPLETE: "The payment is incomplete. Nothing was published. No money was taken.",
  WRONG_AMOUNT:
    "The paid amount did not match $1. Do not pay again. Confirm this payment, or contact support with your receipt.",
  WRONG_RECIPIENT:
    "This payment did not reach The Wall. Do not pay again. Confirm this payment, or contact support with your receipt.",
  WRONG_NETWORK:
    "The payment opened in the wrong place. If you already paid, confirm this payment — do not send a second $1.",
  TX_ALREADY_USED: "This payment already published a sentence. Do not pay again.",
  HASH_MISMATCH: "This checkout no longer matches the sentence. Do not pay again. Confirm this payment first.",
  INTENT_EXPIRED:
    "This checkout expired. If you already paid, confirm this payment. A new checkout will not take a second $1 unless you pay again.",
  INTENT_FULFILLED: "This payment already published a sentence. Do not pay again.",
  INTENT_NOT_FOUND: "If you already paid, confirm this payment. Do not send a second $1.",
  PAID_AFTER_CLOSE:
    "Your $1 was received after The Wall closed. The sentence was not published. Do not pay again. A refund is not promised. Keep your receipt.",
  ARCHIVE_SEAL_FAILED:
    "Results may already be public. The archive is not verified until the seal succeeds. Retry the seal.",
  DUPLICATE_REACTION: "You already reacted to this message.",
  MESSAGE_NOT_FOUND: "That message does not exist on this Wall.",
  CERTIFICATE_INVALID: "This certificate link is invalid. Check the Wall Key you saved.",
  CLAIM_INVALID: "That Wall Key does not match this message.",
  CLAIM_NOT_WINNER: "This message has not won a prize that can be claimed.",
  CLAIM_LOCKED: "Too many failed Wall Key attempts. Wait before trying again.",
  CLAIM_CHALLENGE: "Start the claim from this page, then try again.",
  FORBIDDEN: "You do not have access to this area.",
  CONFIRMATION_REQUIRED: "This operation needs an explicit confirmation before it runs.",
  UNAVAILABLE: "The Wall is temporarily unreachable. Try again in a moment.",
  INSUFFICIENT_USDC: "Add $1 in the payment window, then try again. No money was taken.",
  CONFIG: "The Wall is not fully configured. Try again in a moment.",
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly recovery: string;

  constructor(code: ErrorCode, message: string, status = 400, recovery?: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.recovery = recovery ?? RECOVERY[code];
  }
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && value in ERROR_CODES;
}

/** Bundlers can duplicate this class; still honor a real AppError-shaped throw. */
export function asAppError(error: unknown): AppError | null {
  if (error instanceof AppError) return error;
  if (!error || typeof error !== "object") return null;
  const row = error as { name?: unknown; code?: unknown; message?: unknown; status?: unknown; recovery?: unknown };
  if (row.name !== "AppError" || !isErrorCode(row.code)) return null;
  const message = typeof row.message === "string" ? row.message : RECOVERY[row.code];
  const status = typeof row.status === "number" ? row.status : 400;
  const recovery = typeof row.recovery === "string" ? row.recovery : undefined;
  return new AppError(row.code, message, status, recovery);
}

export function publicErrorPayload(error: unknown): {
  error: string;
  code: string;
  recovery: string;
  status: number;
} {
  const app = asAppError(error);
  if (app) {
    return {
      error: redactSensitiveText(app.message),
      code: app.code,
      recovery: redactSensitiveText(app.recovery),
      status: app.status,
    };
  }
  if (error instanceof ZodError) {
    return {
      error: "Invalid request.",
      code: ERROR_CODES.VALIDATION,
      recovery: RECOVERY.VALIDATION,
      status: 400,
    };
  }
  return {
    error: "Something went wrong.",
    code: ERROR_CODES.UNAVAILABLE,
    recovery: RECOVERY.UNAVAILABLE,
    status: 500,
  };
}
