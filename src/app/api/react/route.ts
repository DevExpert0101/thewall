import { protectAnonymousWrite } from "@/lib/abuse/protect";
import { clientIpHashForLimit } from "@/lib/abuse/ip";
import { isTurnstileConfigured, verifyTurnstileToken } from "@/lib/abuse/turnstile";
import { mapPublishError } from "@/lib/data/rate-limit";
import { eventSlug, getEventOps, getEventSnapshot, loadEventSnapshot } from "@/lib/data/event";
import { addSimulatedReaction, assertNotSimulatedInProduction, isSimulationEvent } from "@/lib/data/simulation";
import { isSimulation } from "@/lib/env";
import { assertPaidSurfaceConfigured } from "@/lib/env/production";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { assertReactOpen } from "@/lib/event/state";
import { isStrictBot } from "@/lib/ops/controls";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import {
  challengeReactionOrThrow,
  observeReactionSuccess,
  persistReactionSignals,
  recordReactionSignals,
} from "@/lib/reactions/integrity";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { reactSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = reactSchema.parse(await readJson(request));
    const event = await getEventSnapshot(eventSlug());
    const ops = await getEventOps();
    assertReactOpen(event, ops);
    assertPaidSurfaceConfigured();
    assertNotSimulatedInProduction(event.id);

    const user = await protectAnonymousWrite({
      request,
      action: "react",
      turnstileToken: body.turnstileToken,
      forceTurnstile: isStrictBot(ops),
    });
    const observed = {
      ipHash: clientIpHashForLimit(request),
      userId: user.id,
      messageId: body.messageId,
      newSession: !user.restored,
      userAgent: request.headers.get("user-agent"),
    };
    const decision = challengeReactionOrThrow(observed, body.turnstileToken);
    if (decision.challenge) {
      if (!isTurnstileConfigured()) {
        throw new AppError(
          ERROR_CODES.TURNSTILE,
          "Complete the check to keep reacting. You can still read the wall.",
        );
      }
      await verifyTurnstileToken(body.turnstileToken, request);
    }

    const latest = await loadEventSnapshot(eventSlug());
    assertReactOpen(latest, ops);

    const reactionCount =
      isSimulation() || isSimulationEvent(latest.id)
        ? addSimulatedReaction(body.messageId, user.id, body.idempotencyKey)
        : await addLiveReaction(body.messageId, user.id, body.idempotencyKey);

    observeReactionSuccess(observed);
    if (decision.signals.length > 0) {
      recordReactionSignals(decision.signals);
      void persistReactionSignals(decision.signals);
    }

    return jsonOk({ reactionCount });
  } catch (error) {
    return jsonError(error);
  }
}

async function addLiveReaction(
  messageId: string,
  userId: string,
  idempotencyKey?: string,
): Promise<number> {
  const db = createServiceSupabase();
  const { data, error } = await db.rpc("add_fire_reaction", {
    p_message_id: messageId,
    p_user_id: userId,
    p_idempotency_key: idempotencyKey ?? null,
  });

  if (error) {
    throw mapPublishError(error.message);
  }

  return data.reaction_count as number;
}
