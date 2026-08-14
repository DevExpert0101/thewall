import { jsonError, jsonOk } from "@/lib/http";
import { cacheForPhase, eventSlug, getEventSnapshot } from "@/lib/data/event";

export async function GET() {
  try {
    const event = await getEventSnapshot(eventSlug());
    return jsonOk(
      { configured: event.id !== "local", ...event },
      { cache: cacheForPhase(event.phase) },
    );
  } catch (error) {
    return jsonError(error);
  }
}
