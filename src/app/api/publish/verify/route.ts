import { protectAnonymousWrite } from "@/lib/abuse/protect";
import { mapPublishError } from "@/lib/data/rate-limit";
import { eventSlug, getEventSnapshot, loadEventSnapshot } from "@/lib/data/event";
import { assertNotSimulatedInProduction, fulfillSimulatedPayment, isSimulationEvent } from "@/lib/data/simulation";
import { isSimulation } from "@/lib/env";
import { assertPaidSurfaceConfigured } from "@/lib/env/production";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { publishDecisionAfterPayment } from "@/lib/payment/close-policy";
import { getPaymentProvider } from "@/lib/payment/provider";
import {
  assertIntentFulfillable,
  assertIntentOwned,
  intentNetwork,
  type StoredIntent,
} from "@/lib/payment/fulfillment";
import { paidAfterCloseError } from "@/lib/payment/recover";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { verifyPaymentSchema } from "@/lib/validation";
import { sanitizeAnalyticsMetadata } from "@/lib/analytics";
import { preflightMessage } from "@/lib/publish/preflight";

export async function POST(request: Request) {
  try {
    const body = verifyPaymentSchema.parse(await readJson(request));
    const event = await getEventSnapshot(eventSlug());
    const user = await protectAnonymousWrite({ request, action: "verify" });

    if (isSimulation() || isSimulationEvent(event.id)) {
      const published = fulfillSimulatedPayment({
        intentId: body.intentId,
        userId: user.id,
        paymentId: body.transactionHash,
      });
      return jsonOk(published);
    }

    assertPaidSurfaceConfigured();
    assertNotSimulatedInProduction(event.id);

    const db = createServiceSupabase();

    const { data: intentRow, error: intentError } = await db
      .from("payment_intents")
      .select("*")
      .eq("id", body.intentId)
      .maybeSingle();

    if (intentError) {
      throw new AppError(ERROR_CODES.UNAVAILABLE, "Could not load payment intent.", 503);
    }
    if (!intentRow) {
      throw new AppError(ERROR_CODES.INTENT_NOT_FOUND, "Payment intent not found.");
    }

    const intent = intentRow as StoredIntent;
    assertIntentOwned(intent, user.id);

    if (intent.status === "fulfilled") {
      const { data: existing } = await db
        .from("messages")
        .select("id, public_number, published_at")
        .eq("payment_intent_id", intent.id)
        .maybeSingle();
      if (existing) {
        return jsonOk({
          publicNumber: existing.public_number as number,
          messageId: existing.id as string,
          publishedAt: existing.published_at as string,
          recovered: true,
        });
      }
      throw new AppError(ERROR_CODES.INTENT_FULFILLED, "Payment already used.");
    }

    let intentExpired = false;
    try {
      assertIntentFulfillable(intent, user.id);
    } catch (error) {
      if (error instanceof AppError && error.code === ERROR_CODES.INTENT_EXPIRED) {
        intentExpired = true;
        await db
          .from("payment_intents")
          .update({ status: "expired" })
          .eq("id", intent.id)
          .eq("status", "created");
      } else {
        throw error;
      }
    }

    const provider = getPaymentProvider();
    if (provider.network !== intentNetwork(intent)) {
      throw new AppError(ERROR_CODES.WRONG_NETWORK, "Unexpected payment network.");
    }

    let verified;
    try {
      verified = await provider.verify({
        paymentId: body.transactionHash,
        expectedAmount: String(intent.amount),
        expectedRecipient: intent.recipient_wallet as `0x${string}`,
        expectedNetwork: intentNetwork(intent),
        intentCreatedAt: intent.created_at,
      });
    } catch (error) {
      const code = error instanceof AppError ? error.code : "PAYMENT_FAILED";
      await db.from("payment_failures").insert({
        payment_intent_id: intent.id,
        transaction_hash: body.transactionHash,
        reason_code: code,
      });
      throw error;
    }

    const latest = await loadEventSnapshot(eventSlug());
    if (publishDecisionAfterPayment(latest.phase, { endsAt: latest.endsAt }) === "paid_after_close") {
      await db.from("payment_failures").insert({
        payment_intent_id: intent.id,
        transaction_hash: verified.id,
        reason_code: "event_closed",
      });
      throw paidAfterCloseError();
    }

    if (intentExpired) {
      throw new AppError(ERROR_CODES.INTENT_EXPIRED, "Payment window expired.");
    }

    if (!intent.claim_secret_hash) {
      throw new AppError(
        ERROR_CODES.INTENT_NOT_FOUND,
        "This checkout has no Wall Key. Start again — do not pay twice.",
      );
    }

    let checked;
    try {
      checked = await preflightMessage(intent.message_text);
    } catch (error) {
      if (error instanceof AppError && error.code === ERROR_CODES.MODERATION_REJECTED) {
        throw new AppError(
          ERROR_CODES.MODERATION_UNPUBLISHABLE,
          "Payment was received. This sentence was not published.",
          409,
        );
      }
      throw error;
    }
    if (checked.text !== intent.message_text) {
      throw new AppError(
        ERROR_CODES.HASH_MISMATCH,
        "The paid message no longer matches checkout.",
      );
    }

    const { data: published, error: pubError } = await db.rpc("publish_paid_message", {
      p_intent_id: intent.id,
      p_tx_hash: verified.id,
      p_sender: verified.sender,
      p_recipient: verified.recipient,
      p_amount: verified.amount,
      p_currency: intent.currency,
      p_network: verified.network,
      p_token_hash: intent.claim_secret_hash,
    });

    if (pubError) {
      await db.from("payment_failures").insert({
        payment_intent_id: intent.id,
        transaction_hash: verified.id,
        reason_code: pubError.message,
      });
      if (pubError.message.includes("event_ended")) {
        throw paidAfterCloseError();
      }
      if (pubError.message.includes("intent_already_fulfilled")) {
        const { data: existing } = await db
          .from("messages")
          .select("id, public_number, published_at")
          .eq("payment_intent_id", intent.id)
          .maybeSingle();
        if (existing) {
          return jsonOk({
            publicNumber: existing.public_number as number,
            messageId: existing.id as string,
            publishedAt: existing.published_at as string,
            recovered: true,
          });
        }
      }
      throw mapPublishError(pubError.message);
    }

    if (checked.moderationStatus === "flagged" && published?.message_id) {
      await db
        .from("messages")
        .update({ moderation_status: "flagged" })
        .eq("id", published.message_id);
    }

    await db.from("analytics_events").insert({
      name: "message_published",
      metadata: sanitizeAnalyticsMetadata({
        publicNumber: published.public_number,
      }),
    });

    return jsonOk({
      publicNumber: published.public_number as number,
      messageId: published.message_id as string,
      publishedAt: published.published_at as string,
    });
  } catch (error) {
    return jsonError(error);
  }
}
