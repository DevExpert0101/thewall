import "server-only";

import { consumeRateLimit } from "@/lib/data/rate-limit";
import { hashOwnershipSecret, tokensEqual } from "@/lib/crypto";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";
import { verifySimulatedClaim, saveSimulatedWinnerDelivery } from "@/lib/data/simulation";
import { isOwnershipSecret } from "@/lib/ownership/wall-key";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { ABUSE_LIMITS, rateLimitKey } from "@/lib/abuse/keys";
import { clientIpHashForLimit } from "@/lib/abuse/ip";
import { peekAnonymousUser } from "@/lib/auth";

const MISSING_HASH = hashOwnershipSecret("the-wall-missing-claim-placeholder-key");
const FAIL_WINDOW_SECONDS = 15 * 60;
const FAIL_IP_LIMIT = 8;
const FAIL_MESSAGE_LIMIT = 5;

export type ClaimOutcome = "success" | "invalid" | "not_found" | "locked" | "rate_limited";

export type ClaimAttempt = {
  publicNumber: number;
  outcome: ClaimOutcome;
  createdAt: string;
  ipHash?: string;
};

export type ClaimResult = {
  verified: boolean;
  publicNumber: number;
  won: boolean;
  nominated: boolean;
};

export type WinnerDelivery = {
  contactEmail?: string;
  payoutAddress?: string;
  legalAcknowledged: boolean;
};

const attempts: ClaimAttempt[] = [];

export function listClaimAttempts(limit = 25): ClaimAttempt[] {
  return attempts.slice(0, limit);
}

export function resetClaimAttempts() {
  attempts.splice(0, attempts.length);
}

export async function rateLimitClaim(request: Request): Promise<void> {
  const ipHash = clientIpHashForLimit(request);
  const [limit, windowSeconds] = ABUSE_LIMITS.claim.ip;
  await consumeRateLimit(rateLimitKey("claim", "ip", ipHash), limit, windowSeconds);
  const user = await peekAnonymousUser();
  if (!user) return;
  const [userLimit, userWindow] = ABUSE_LIMITS.claim.user;
  await consumeRateLimit(rateLimitKey("claim", "user", user.id), userLimit, userWindow);
}

export async function recordClaimAttempt(input: {
  publicNumber: number;
  outcome: ClaimOutcome;
  eventId?: string;
  ipHash?: string;
}): Promise<void> {
  const row: ClaimAttempt = {
    publicNumber: input.publicNumber,
    outcome: input.outcome,
    createdAt: new Date().toISOString(),
    ipHash: input.ipHash,
  };
  attempts.unshift(row);
  if (attempts.length > 200) attempts.length = 200;
  if (isSimulation() || !hasSupabaseConfig()) return;
  try {
    const db = createServiceSupabase();
    await db.from("claim_attempts").insert({
      event_id: input.eventId ?? null,
      public_number: input.publicNumber,
      outcome: input.outcome,
      ip_hash: input.ipHash ?? null,
    });
  } catch {
    // local audit still holds the row; never include a Wall Key
  }
}

function failedAttemptsSince(ipHash: string, since: number, publicNumber?: number): number {
  return attempts.filter((row) => {
    if (row.ipHash !== ipHash) return false;
    if (Date.parse(row.createdAt) < since) return false;
    if (row.outcome !== "invalid" && row.outcome !== "not_found") return false;
    if (publicNumber != null && row.publicNumber !== publicNumber) return false;
    return true;
  }).length;
}

export async function assertClaimNotLocked(request: Request, publicNumber: number): Promise<void> {
  const ipHash = clientIpHashForLimit(request);
  const since = Date.now() - FAIL_WINDOW_SECONDS * 1000;
  if (
    failedAttemptsSince(ipHash, since) >= FAIL_IP_LIMIT ||
    failedAttemptsSince(ipHash, since, publicNumber) >= FAIL_MESSAGE_LIMIT
  ) {
    throw new AppError(
      ERROR_CODES.CLAIM_LOCKED,
      "Too many failed Wall Key attempts. Wait before trying again.",
      429,
    );
  }
  if (isSimulation() || !hasSupabaseConfig()) return;
  try {
    const db = createServiceSupabase();
    const sinceIso = new Date(since).toISOString();
    const { count: ipCount } = await db
      .from("claim_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .in("outcome", ["invalid", "not_found"])
      .gte("created_at", sinceIso);
    const { count: messageCount } = await db
      .from("claim_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .eq("public_number", publicNumber)
      .in("outcome", ["invalid", "not_found"])
      .gte("created_at", sinceIso);
    if ((ipCount ?? 0) >= FAIL_IP_LIMIT || (messageCount ?? 0) >= FAIL_MESSAGE_LIMIT) {
      throw new AppError(
        ERROR_CODES.CLAIM_LOCKED,
        "Too many failed Wall Key attempts. Wait before trying again.",
        429,
      );
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
  }
}

export async function verifyMessageClaim(input: {
  eventId: string;
  publicNumber: number;
  wallKey: string;
}): Promise<{ messageId: string; won: boolean; nominated: boolean }> {
  if (!isOwnershipSecret(input.wallKey)) {
    tokensEqual(MISSING_HASH, hashOwnershipSecret("invalid-format-wall-key"));
    throw new AppError(ERROR_CODES.CLAIM_INVALID, "That Wall Key does not match this message.", 404);
  }

  if (isSimulation() || input.eventId === "local" || input.eventId.startsWith("local-") || !hasSupabaseConfig()) {
    return verifySimulatedClaim({
      publicNumber: input.publicNumber,
      wallKey: input.wallKey,
    });
  }

  const submitted = hashOwnershipSecret(input.wallKey);

  const db = createServiceSupabase();
  const { data: message, error } = await db
    .from("messages")
    .select("id, final_rank")
    .eq("event_id", input.eventId)
    .eq("public_number", input.publicNumber)
    .maybeSingle();

  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Claim lookup failed.", 503);
  }
  if (!message) {
    tokensEqual(MISSING_HASH, submitted);
    throw new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, "Message not found.", 404);
  }

  const { data: ownership } = await db
    .from("message_ownership")
    .select("token_hash")
    .eq("message_id", message.id)
    .maybeSingle();

  const stored = ownership?.token_hash ?? MISSING_HASH;
  if (!tokensEqual(stored, submitted) || !ownership?.token_hash) {
    throw new AppError(ERROR_CODES.CLAIM_INVALID, "That Wall Key does not match this message.", 404);
  }

  const { data: nomination } = await db
    .from("prize_nominations")
    .select("id")
    .eq("message_id", message.id)
    .maybeSingle();

  return {
    messageId: message.id,
    won: message.final_rank === 1,
    nominated: Boolean(nomination?.id),
  };
}

export async function saveWinnerDelivery(input: {
  messageId: string;
  delivery: WinnerDelivery;
}): Promise<void> {
  if (!input.delivery.legalAcknowledged) {
    throw new AppError(
      ERROR_CODES.VALIDATION,
      "A prize may require identity or tax information. Confirm you understand before we collect delivery details.",
    );
  }
  const email = input.delivery.contactEmail?.trim().toLowerCase() || null;
  const address = input.delivery.payoutAddress?.trim().toLowerCase() || null;
  if (!email && !address) {
    throw new AppError(ERROR_CODES.VALIDATION, "Enter a contact email or a payout wallet.");
  }

  if (isSimulation() || !hasSupabaseConfig()) {
    saveSimulatedWinnerDelivery({
      messageId: input.messageId,
      contactEmail: email,
      payoutAddress: address,
    });
    return;
  }

  const db = createServiceSupabase();
  const { error } = await db.from("prize_nominations").upsert(
    {
      message_id: input.messageId,
      payout_method: address ? "usdc" : "contact",
      payout_address: address,
      contact_email: email,
      legal_acknowledged_at: new Date().toISOString(),
    },
    { onConflict: "message_id" },
  );
  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Could not save prize delivery details.", 503);
  }
}

/** @deprecated use saveWinnerDelivery */
export async function nominatePrize(input: {
  messageId: string;
  payoutAddress: string;
}): Promise<void> {
  await saveWinnerDelivery({
    messageId: input.messageId,
    delivery: {
      payoutAddress: input.payoutAddress,
      legalAcknowledged: true,
    },
  });
}
