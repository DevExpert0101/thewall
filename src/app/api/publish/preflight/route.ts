import { protectAnonymousWrite } from "@/lib/abuse/protect";
import { eventSlug, getEventSnapshot } from "@/lib/data/event";
import { assertEventLive } from "@/lib/event/state";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { preflightMessage } from "@/lib/publish/preflight";
import { preflightSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = preflightSchema.parse(await readJson(request));
    await protectAnonymousWrite({ request, action: "preflight" });

    const event = await getEventSnapshot(eventSlug());
    assertEventLive(event.phase);

    const result = await preflightMessage(body.message);
    return jsonOk({
      text: result.text,
      moderationStatus: result.moderationStatus,
    });
  } catch (error) {
    return jsonError(error);
  }
}
