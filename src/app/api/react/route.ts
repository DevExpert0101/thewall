import { protectAnonymousWrite } from "@/lib/abuse/protect";
import { mapPublishError } from "@/lib/data/rate-limit";
import { eventSlug, getEventSnapshot } from "@/lib/data/event";
import { addSimulatedReaction, isSimulationEvent } from "@/lib/data/simulation";
import { isSimulation } from "@/lib/env";
import { assertEventLive } from "@/lib/event/state";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { reactSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = reactSchema.parse(await readJson(request));
    const event = await getEventSnapshot(eventSlug());
    assertEventLive(event.phase);

    const user = await protectAnonymousWrite({ request, action: "react" });

    if (isSimulation() || isSimulationEvent(event.id)) {
      return jsonOk({ reactionCount: addSimulatedReaction(body.messageId, user.id) });
    }

    const db = createServiceSupabase();
    const { data, error } = await db.rpc("add_fire_reaction", {
      p_message_id: body.messageId,
      p_user_id: user.id,
    });

    if (error) {
      throw mapPublishError(error.message);
    }

    await db.from("analytics_events").insert({
      name: "reaction",
      metadata: {},
    });

    return jsonOk({ reactionCount: data.reaction_count as number });
  } catch (error) {
    return jsonError(error);
  }
}
