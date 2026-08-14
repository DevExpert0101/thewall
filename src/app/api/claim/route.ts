import { rateLimitClaim, nominatePrize, verifyMessageClaim } from "@/lib/ownership/claim";
import { eventSlug, getEventSnapshot } from "@/lib/data/event";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { claimSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    await rateLimitClaim(request);
    const body = claimSchema.parse(await readJson(request));
    const event = await getEventSnapshot(eventSlug());
    const claim = await verifyMessageClaim({
      eventId: event.id,
      publicNumber: body.publicNumber,
      wallKey: body.wallKey,
    });

    const archived = event.phase === "archived";
    const canNominate = archived && claim.won;

    if (body.payoutMethod || body.payoutAddress) {
      if (!canNominate) {
        throw new AppError(
          ERROR_CODES.CLAIM_NOT_WINNER,
          archived
            ? "This message did not win The Wall."
            : "Payout instructions are collected only after The Wall closes.",
          403,
        );
      }
      if (!body.payoutAddress) {
        throw new AppError(ERROR_CODES.VALIDATION, "Enter a payout wallet.");
      }
      await nominatePrize({
        messageId: claim.messageId,
        payoutAddress: body.payoutAddress,
      });
      return jsonOk({
        verified: true,
        publicNumber: body.publicNumber,
        won: true,
        nominated: true,
      });
    }

    return jsonOk({
      verified: true,
      publicNumber: body.publicNumber,
      won: canNominate,
      nominated: claim.nominated,
    });
  } catch (error) {
    return jsonError(error);
  }
}
