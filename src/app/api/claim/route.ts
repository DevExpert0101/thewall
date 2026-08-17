import {
  assertClaimNotLocked,
  rateLimitClaim,
  recordClaimAttempt,
  verifyMessageClaim,
} from "@/lib/ownership/claim";
import { consumeClaimChallenge, issueClaimSession } from "@/lib/ownership/claim-session";
import { clientIpHashForLimit } from "@/lib/abuse/ip";
import { eventSlug, getEventSnapshot } from "@/lib/data/event";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { claimSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const ipHash = clientIpHashForLimit(request);
  let publicNumber = 0;
  try {
    await rateLimitClaim(request);
    const body = claimSchema.parse(await readJson(request));
    publicNumber = body.publicNumber;
    await consumeClaimChallenge();
    await assertClaimNotLocked(request, body.publicNumber);
    const event = await getEventSnapshot(eventSlug());
    const claim = await verifyMessageClaim({
      eventId: event.id,
      publicNumber: body.publicNumber,
      wallKey: body.wallKey,
    });
    await recordClaimAttempt({
      publicNumber: body.publicNumber,
      outcome: "success",
      eventId: event.id,
      ipHash,
    });
    await issueClaimSession({
      messageId: claim.messageId,
      publicNumber: body.publicNumber,
      won: event.phase === "archived" && claim.won,
    });
    return jsonOk({
      verified: true,
      publicNumber: body.publicNumber,
      won: event.phase === "archived" && claim.won,
      nominated: claim.nominated,
    });
  } catch (error) {
    const outcome =
      error instanceof AppError && error.code === ERROR_CODES.CLAIM_LOCKED
        ? "locked"
        : error instanceof AppError && error.code === ERROR_CODES.RATE_LIMITED
          ? "rate_limited"
          : error instanceof AppError && error.code === ERROR_CODES.MESSAGE_NOT_FOUND
            ? "not_found"
            : "invalid";
    const skipAudit =
      error instanceof AppError &&
      (error.code === ERROR_CODES.CLAIM_CHALLENGE || error.code === ERROR_CODES.RATE_LIMITED);
    if (publicNumber > 0 && !skipAudit) {
      await recordClaimAttempt({ publicNumber, outcome, ipHash });
    }
    return jsonError(error);
  }
}
