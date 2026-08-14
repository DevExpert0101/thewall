import { ZodError } from "zod";
import { redactSensitiveText } from "@/lib/abuse/redact";

export const ERROR_CODES = {
  EVENT_UPCOMING: "EVENT_UPCOMING",
  EVENT_ENDED: "EVENT_ENDED",
  EVENT_NOT_LIVE: "EVENT_NOT_LIVE",
  VALIDATION: "VALIDATION",
  TURNSTILE: "TURNSTILE",
  MODERATION_REJECTED: "MODERATION_REJECTED",
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
  DUPLICATE_REACTION: "DUPLICATE_REACTION",
  MESSAGE_NOT_FOUND: "MESSAGE_NOT_FOUND",
  CERTIFICATE_INVALID: "CERTIFICATE_INVALID",
  CLAIM_INVALID: "CLAIM_INVALID",
  CLAIM_NOT_WINNER: "CLAIM_NOT_WINNER",
  FORBIDDEN: "FORBIDDEN",
  CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
  UNAVAILABLE: "UNAVAILABLE",
  INSUFFICIENT_USDC: "INSUFFICIENT_USDC",
  CONFIG: "CONFIG",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const RECOVERY: Record<ErrorCode, string> = {
  EVENT_UPCOMING: "The Wall has not opened yet. Come back when the countdown reaches zero.",
  EVENT_ENDED: "The Wall is closed. You can still read every message in the archive.",
  EVENT_NOT_LIVE: "Publishing is only possible while The Wall is live.",
  VALIDATION: "Check your message and try again.",
  TURNSTILE:
    "Please complete the verification challenge and try again. You can keep reading the wall either way.",
  MODERATION_REJECTED:
    "This message cannot be published. Revise the text — you have not been charged.",
  UNAUTHENTICATED:
    "Refresh the page to start a new anonymous session. Reading the wall does not require one.",
  RATE_LIMITED: "You are moving too fast. Wait a moment, then try again.",
  PAYMENT_PENDING: "The payment is still confirming. Keep this page open.",
  PAYMENT_FAILED: "The payment did not complete. You have not been charged for a message.",
  PAYMENT_CANCELED: "Payment was canceled. Your message was not published.",
  PAYMENT_INCOMPLETE: "The transaction is incomplete. No message was published.",
  WRONG_AMOUNT: "The paid amount did not match 1.00 USDC. Contact support with your transaction id.",
  WRONG_RECIPIENT: "This payment was not sent to The Wall treasury.",
  WRONG_NETWORK: "This transaction is not on the expected Base network.",
  TX_ALREADY_USED: "This transaction has already been used.",
  HASH_MISMATCH: "The paid message no longer matches the checkout. Start again — do not pay twice.",
  INTENT_EXPIRED: "The payment window expired. Start again — you will not be double-charged for a new message without a new payment.",
  INTENT_FULFILLED: "This payment already published a message.",
  INTENT_NOT_FOUND: "Start the publishing flow again.",
  DUPLICATE_REACTION: "You already reacted to this message.",
  MESSAGE_NOT_FOUND: "That message does not exist on this Wall.",
  CERTIFICATE_INVALID: "This certificate link is invalid. Check the Wall Key you saved.",
  CLAIM_INVALID: "That Wall Key does not match this message.",
  CLAIM_NOT_WINNER: "This message has not won a prize that can be claimed.",
  FORBIDDEN: "You do not have access to this area.",
  CONFIRMATION_REQUIRED: "This operation needs an explicit confirmation before it runs.",
  UNAVAILABLE: "The Wall is temporarily unreachable. Try again in a moment.",
  INSUFFICIENT_USDC: "Your wallet does not have 1.00 USDC on Base. Add USDC, then try again.",
  CONFIG: "The Wall is not fully configured. Try again in a moment.",
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly recovery: string;

  constructor(code: ErrorCode, message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.recovery = RECOVERY[code];
  }
}

export function publicErrorPayload(error: unknown): {
  error: string;
  code: string;
  recovery: string;
  status: number;
} {
  if (error instanceof AppError) {
    return {
      error: redactSensitiveText(error.message),
      code: error.code,
      recovery: redactSensitiveText(error.recovery),
      status: error.status,
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
