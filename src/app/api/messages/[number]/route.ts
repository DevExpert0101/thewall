import { jsonError, jsonOk } from "@/lib/http";
import { cacheForPhase, eventSlug, getEventSnapshot } from "@/lib/data/event";
import { getMessageByNumber } from "@/lib/data/messages";
import { parsePublicNumber } from "@/lib/utils";
import { AppError, ERROR_CODES } from "@/lib/errors";

export async function GET(
  _request: Request,
  context: { params: Promise<{ number: string }> },
) {
  try {
    const { number } = await context.params;
    const n = parsePublicNumber(number);
    if (!n) {
      throw new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, "Message not found.", 404);
    }
    const event = await getEventSnapshot(eventSlug());
    const message = await getMessageByNumber(event.id, n);
    return jsonOk({ event, message }, { cache: cacheForPhase(event.phase) });
  } catch (error) {
    return jsonError(error);
  }
}
