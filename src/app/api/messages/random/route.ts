import { jsonError, jsonOk } from "@/lib/http";
import { eventSlug, getEventSnapshot } from "@/lib/data/event";
import { loadSealedEdition } from "@/lib/data/editions";
import { pickRandomMessages } from "@/lib/data/messages";
import { publicMessageForPhase } from "@/lib/event/state";
import { randomMessagesQuerySchema } from "@/lib/validation";
import { parseExclude } from "@/lib/wall/random";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = randomMessagesQuerySchema.parse({
      exclude: url.searchParams.get("exclude") ?? undefined,
      count: url.searchParams.get("count") ?? undefined,
      edition: url.searchParams.get("edition") ?? undefined,
    });
    const event = parsed.edition
      ? await loadSealedEdition(parsed.edition)
      : await getEventSnapshot(eventSlug());
    const result = await pickRandomMessages({
      eventId: event.id,
      exclude: parseExclude(parsed.exclude),
      count: parsed.count,
    });
    return jsonOk({
      messages: result.messages.map((message) => publicMessageForPhase(message, event.phase)),
      remaining: result.remaining,
      total: result.total,
    });
  } catch (error) {
    return jsonError(error);
  }
}
