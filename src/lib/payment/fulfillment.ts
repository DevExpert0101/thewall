import { sha256Hex, tokensEqual } from "@/lib/crypto";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { assertCanonicalPrice } from "@/lib/payment/amount";
import { CURRENCY } from "@/lib/constants";
import type { PaymentNetwork } from "@/lib/payment/types";

export type StoredIntent = {
  id: string;
  anonymous_user_id: string;
  status: string;
  expires_at: string;
  created_at?: string;
  message_text: string;
  message_hash: string;
  amount: string | number;
  currency: string;
  network: string;
  recipient_wallet: string;
  claim_secret_hash?: string | null;
};

export function bindMessageHash(text: string): string {
  return sha256Hex(text);
}

export function assertMessageBound(text: string, hash: string): void {
  if (!tokensEqual(sha256Hex(text), hash)) {
    throw new AppError(
      ERROR_CODES.HASH_MISMATCH,
      "The paid message no longer matches checkout.",
    );
  }
}

export function assertIntentOwned(intent: StoredIntent, actorId: string): void {
  if (intent.anonymous_user_id !== actorId) {
    throw new AppError(ERROR_CODES.FORBIDDEN, "This payment does not belong to you.", 403);
  }
}

export function assertIntentFulfillable(
  intent: StoredIntent,
  actorId: string,
  now: Date = new Date(),
): void {
  assertIntentOwned(intent, actorId);
  if (intent.status === "fulfilled") {
    throw new AppError(ERROR_CODES.INTENT_FULFILLED, "Payment already used.");
  }
  if (intent.status === "expired" || new Date(intent.expires_at).getTime() < now.getTime()) {
    throw new AppError(ERROR_CODES.INTENT_EXPIRED, "Payment window expired.");
  }
  if (intent.status !== "created") {
    throw new AppError(ERROR_CODES.INTENT_NOT_FOUND, "Payment intent is not active.");
  }
  if (intent.currency !== CURRENCY) {
    throw new AppError(ERROR_CODES.WRONG_AMOUNT, "Unexpected currency.");
  }
  assertCanonicalPrice(String(intent.amount));
  assertMessageBound(intent.message_text, intent.message_hash);
}

/** A transfer mined before this checkout cannot pay for it. */
export function assertTxBoundToCheckout(
  minedAtSeconds: number | null | undefined,
  intentCreatedAt: string,
): void {
  if (minedAtSeconds == null || !Number.isFinite(minedAtSeconds)) {
    throw new AppError(ERROR_CODES.PAYMENT_INCOMPLETE, "Payment timestamp missing.");
  }
  const created = Math.floor(new Date(intentCreatedAt).getTime() / 1000);
  if (!Number.isFinite(created)) {
    throw new AppError(ERROR_CODES.INTENT_NOT_FOUND, "Payment intent is invalid.");
  }
  const slackSeconds = 30;
  if (minedAtSeconds + slackSeconds < created) {
    throw new AppError(
      ERROR_CODES.TX_ALREADY_USED,
      "This transaction predates checkout and cannot publish a new sentence.",
    );
  }
}

export function intentNetwork(intent: StoredIntent): PaymentNetwork {
  if (intent.network !== "base" && intent.network !== "base-sepolia") {
    throw new AppError(ERROR_CODES.WRONG_NETWORK, "Unexpected payment network.");
  }
  return intent.network;
}
