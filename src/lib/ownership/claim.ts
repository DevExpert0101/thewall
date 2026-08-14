import "server-only";

import { consumeRateLimit } from "@/lib/data/rate-limit";
import { hashOwnershipSecret, tokensEqual } from "@/lib/crypto";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";
import { verifySimulatedClaim } from "@/lib/data/simulation";
import { isOwnershipSecret } from "@/lib/ownership/wall-key";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { ABUSE_LIMITS, rateLimitKey } from "@/lib/abuse/keys";
import { clientIpHashForLimit } from "@/lib/abuse/ip";

const MISSING_HASH = hashOwnershipSecret("the-wall-missing-claim-placeholder-key");

export type ClaimResult = {
  verified: boolean;
  publicNumber: number;
  won: boolean;
  nominated: boolean;
};

export async function rateLimitClaim(request: Request): Promise<void> {
  const ipHash = clientIpHashForLimit(request);
  const [limit, windowSeconds] = ABUSE_LIMITS.claim.ip;
  await consumeRateLimit(rateLimitKey("claim", "ip", ipHash), limit, windowSeconds);
}

export async function verifyMessageClaim(input: {
  eventId: string;
  publicNumber: number;
  wallKey: string;
}): Promise<{ messageId: string; won: boolean; nominated: boolean }> {
  if (!isOwnershipSecret(input.wallKey)) {
    throw new AppError(ERROR_CODES.CLAIM_INVALID, "That Wall Key is not valid.", 404);
  }

  if (isSimulation() || input.eventId === "local" || !hasSupabaseConfig()) {
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

export async function nominatePrize(input: {
  messageId: string;
  payoutAddress: string;
}): Promise<void> {
  const db = createServiceSupabase();
  const address = input.payoutAddress.toLowerCase();
  const { error } = await db.from("prize_nominations").upsert(
    {
      message_id: input.messageId,
      payout_method: "usdc",
      payout_address: address,
    },
    { onConflict: "message_id" },
  );
  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Could not save payout instructions.", 503);
  }
}
