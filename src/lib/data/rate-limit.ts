import { AppError, ERROR_CODES } from "@/lib/errors";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";
import { createServiceSupabase } from "@/lib/supabase/admin";

type MemoryBucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, MemoryBucket>();

export function consumeMemoryRateLimit(key: string, limit: number, windowSeconds: number): void {
  const now = Date.now();
  const current = memoryBuckets.get(key);
  if (!current || current.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return;
  }
  if (current.count >= limit) {
    throw new AppError(ERROR_CODES.RATE_LIMITED, "Too many requests.", 429);
  }
  current.count += 1;
}

export function resetMemoryRateLimits() {
  memoryBuckets.clear();
}

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  if (isSimulation() || !hasSupabaseConfig()) {
    consumeMemoryRateLimit(key, limit, windowSeconds);
    return;
  }
  const db = createServiceSupabase();
  const { data, error } = await db.rpc("consume_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Rate limiter unavailable.", 503);
  }
  if (data !== true) {
    throw new AppError(ERROR_CODES.RATE_LIMITED, "Too many requests.", 429);
  }
}

export function mapPublishError(message: string): AppError {
  if (message.includes("event_upcoming")) {
    return new AppError(ERROR_CODES.EVENT_UPCOMING, "The Wall has not opened yet.", 403);
  }
  if (message.includes("event_ended")) {
    return new AppError(ERROR_CODES.EVENT_ENDED, "The Wall has closed.", 403);
  }
  if (message.includes("intent_expired")) {
    return new AppError(ERROR_CODES.INTENT_EXPIRED, "Payment window expired.");
  }
  if (message.includes("intent_already_fulfilled")) {
    return new AppError(ERROR_CODES.INTENT_FULFILLED, "Payment already used.");
  }
  if (message.includes("tx_already_used")) {
    return new AppError(ERROR_CODES.TX_ALREADY_USED, "Transaction already used.");
  }
  if (message.includes("wrong_amount")) {
    return new AppError(ERROR_CODES.WRONG_AMOUNT, "Amount mismatch.");
  }
  if (message.includes("wrong_recipient")) {
    return new AppError(ERROR_CODES.WRONG_RECIPIENT, "Recipient mismatch.");
  }
  if (message.includes("wrong_network")) {
    return new AppError(ERROR_CODES.WRONG_NETWORK, "Network mismatch.");
  }
  if (message.includes("duplicate_reaction")) {
    return new AppError(ERROR_CODES.DUPLICATE_REACTION, "Already reacted.");
  }
  if (message.includes("idempotency_conflict")) {
    return new AppError(ERROR_CODES.VALIDATION, "Reaction replay does not match this sentence.");
  }
  if (message.includes("message_not_found")) {
    return new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, "Message not found.", 404);
  }
  if (message.includes("hash_mismatch")) {
    return new AppError(ERROR_CODES.HASH_MISMATCH, "The paid message no longer matches checkout.");
  }
  if (message.includes("intent_terms_frozen")) {
    return new AppError(ERROR_CODES.HASH_MISMATCH, "Checkout terms cannot be changed after payment.");
  }
  if (message.includes("intent_not_found")) {
    return new AppError(ERROR_CODES.INTENT_NOT_FOUND, "Payment intent not found.");
  }
  if (message.includes("confirmation_required")) {
    return new AppError(
      ERROR_CODES.CONFIRMATION_REQUIRED,
      "Type the confirmation phrase to continue.",
      409,
    );
  }
  if (message.includes("invalid_reason") || message.includes("invalid_moderation_action")) {
    return new AppError(ERROR_CODES.VALIDATION, "Invalid moderation request.");
  }
  if (message.includes("report_not_found")) {
    return new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, "Report not found.", 404);
  }
  return new AppError(ERROR_CODES.UNAVAILABLE, "The operation could not be completed.", 500);
}
