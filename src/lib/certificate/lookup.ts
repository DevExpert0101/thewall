import { ARCHIVAL_REMOVAL_TEXT, ARCHIVAL_TAGLINE } from "@/lib/constants";
import { hashOwnershipSecret, hashToken, tokensEqual } from "@/lib/crypto";
import { isOwnershipSecret } from "@/lib/ownership/wall-key";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";
import { lookupSimulatedCertificate } from "@/lib/data/simulation";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { formatUtcDate } from "@/lib/utils";
import type { CertificatePayload } from "@/lib/types";
import { consumeRateLimit } from "@/lib/data/rate-limit";
import { clientIpHashForLimit } from "@/lib/abuse/ip";
import { ABUSE_LIMITS, rateLimitKey } from "@/lib/abuse/keys";
import { headers } from "next/headers";

const MISSING_HASH = hashToken("the-wall-missing-certificate-placeholder");

async function rateLimitCertificateLookup(): Promise<void> {
  try {
    const incoming = await headers();
    const request = new Request("http://127.0.0.1/certificate", { headers: incoming });
    const ipHash = clientIpHashForLimit(request);
    const [limit, windowSeconds] = ABUSE_LIMITS.certificate.ip;
    await consumeRateLimit(rateLimitKey("certificate", "ip", ipHash), limit, windowSeconds);
  } catch (error) {
    if (error instanceof AppError && error.code === ERROR_CODES.RATE_LIMITED) {
      throw error;
    }
  }
}

export async function lookupCertificate(token: string): Promise<CertificatePayload> {
  await rateLimitCertificateLookup();

  const decoded = decodeURIComponent(token).trim();
  const tokenHash = isOwnershipSecret(decoded)
    ? hashOwnershipSecret(decoded)
    : hashToken("0".repeat(64));

  if (isSimulation() || !hasSupabaseConfig()) {
    const found = isOwnershipSecret(decoded) ? lookupSimulatedCertificate(decoded) : null;
    if (found) return found;
    tokensEqual(MISSING_HASH, tokenHash);
    throw new AppError(
      ERROR_CODES.CERTIFICATE_INVALID,
      "Certificate token is invalid.",
      404,
    );
  }

  if (!isOwnershipSecret(decoded)) {
    tokensEqual(MISSING_HASH, tokenHash);
    throw new AppError(
      ERROR_CODES.CERTIFICATE_INVALID,
      "Certificate token is invalid.",
      404,
    );
  }

  const db = createServiceSupabase();
  const { data: ownership, error } = await db
    .from("message_ownership")
    .select("message_id, token_hash")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Certificate lookup failed.", 503);
  }

  const storedHash = ownership?.token_hash ?? MISSING_HASH;
  if (!tokensEqual(storedHash, tokenHash) || !ownership?.message_id) {
    throw new AppError(
      ERROR_CODES.CERTIFICATE_INVALID,
      "Certificate token is invalid.",
      404,
    );
  }

  const { data: message } = await db
    .from("messages")
    .select("public_number, text, reaction_count, final_rank, published_at, event_id, removed_at")
    .eq("id", ownership.message_id)
    .maybeSingle();

  if (!message) {
    throw new AppError(ERROR_CODES.CERTIFICATE_INVALID, "Certificate not found.", 404);
  }

  const { data: event } = await db
    .from("events")
    .select("title, starts_at")
    .eq("id", message.event_id)
    .maybeSingle();

  return {
    publicNumber: message.public_number,
    text: message.removed_at != null ? ARCHIVAL_REMOVAL_TEXT : message.text,
    reactionCount: message.reaction_count,
    finalRank: message.final_rank,
    publishedAt: message.published_at,
    eventTitle: event?.title ?? "THE WALL",
    eventDate: formatUtcDate(event?.starts_at ?? message.published_at),
    tagline: ARCHIVAL_TAGLINE,
  };
}
