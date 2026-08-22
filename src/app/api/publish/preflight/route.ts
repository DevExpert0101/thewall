import { protectAnonymousWrite } from "@/lib/abuse/protect";
import { eventSlug, getEventOps, getEventSnapshot } from "@/lib/data/event";
import { assertPublishOpen } from "@/lib/event/state";
import { isStrictBot } from "@/lib/ops/controls";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { preflightMessage } from "@/lib/publish/preflight";
import { preflightSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = preflightSchema.parse(await readJson(request));
    const event = await getEventSnapshot(eventSlug());
    const ops = await getEventOps();
    assertPublishOpen(event, ops);
    await protectAnonymousWrite({
      request,
      action: "preflight",
      turnstileToken: body.turnstileToken,
      forceTurnstile: isStrictBot(ops),
    });

    const result = await preflightMessage(body.message);
    return jsonOk({
      text: result.text,
      decision: result.decision,
      moderationStatus: result.moderationStatus,
    });
  } catch (error) {
    return jsonError(error);
  }
}
