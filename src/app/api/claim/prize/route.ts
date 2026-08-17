import { saveWinnerDelivery } from "@/lib/ownership/claim";
import { invalidateClaimSession, readClaimSession } from "@/lib/ownership/claim-session";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { winnerDeliverySchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const session = await readClaimSession();
    if (!session.won) {
      throw new AppError(
        ERROR_CODES.CLAIM_NOT_WINNER,
        "This message has not won a prize that can be claimed.",
        403,
      );
    }
    const body = winnerDeliverySchema.parse(await readJson(request));
    await saveWinnerDelivery({
      messageId: session.messageId,
      delivery: {
        contactEmail: body.contactEmail,
        payoutAddress: body.payoutAddress,
        legalAcknowledged: body.legalAcknowledged,
      },
    });
    await invalidateClaimSession();
    return jsonOk({
      verified: true,
      publicNumber: session.publicNumber,
      won: true,
      nominated: true,
    });
  } catch (error) {
    return jsonError(error);
  }
}
