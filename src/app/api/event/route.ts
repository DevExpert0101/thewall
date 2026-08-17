import { jsonError, jsonOk } from "@/lib/http";
import { eventSlug, getEventSnapshot } from "@/lib/data/event";
import { isSimulation } from "@/lib/env";

/** Current Wall only. Do not inherit the hour-long archived CDN cache. */
const CURRENT_EVENT_CACHE = "public, s-maxage=3, stale-while-revalidate=10";

export async function GET() {
  try {
    const event = await getEventSnapshot(eventSlug());
    return jsonOk(
      { configured: event.id !== "local", ...event },
      { cache: isSimulation() ? "private, no-store" : CURRENT_EVENT_CACHE },
    );
  } catch (error) {
    return jsonError(error);
  }
}
