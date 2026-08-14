import { protectAnonymousWrite } from "@/lib/abuse/protect";
import { mapPublishError } from "@/lib/data/rate-limit";
import { eventSlug, getEventSnapshot } from "@/lib/data/event";
import { fulfillSimulatedPayment, isSimulationEvent } from "@/lib/data/simulation";
import { isSimulation } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { getPaymentProvider } from "@/lib/payment/provider";
import {
  assertIntentFulfillable,
  intentNetwork,
  type StoredIntent,
} from "@/lib/payment/fulfillment";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { verifyPaymentSchema } from "@/lib/validation";
import { sanitizeAnalyticsMetadata } from "@/lib/analytics";
import { preflightMessage } from "@/lib/publish/preflight";

export async function POST(request: Request) {
  try {
    const body = verifyPaymentSchema.parse(await readJson(request));
    const user = await protectAnonymousWrite({ request, action: "verify" });
    const event = await getEventSnapshot(eventSlug());

    if (isSimulation() || isSimulationEvent(event.id)) {
      if (event.phase !== "live") {
        throw new AppError(
          ERROR_CODES.EVENT_ENDED,
          "The Wall closed during checkout.",
          403,
        );
      }
      const published = fulfillSimulatedPayment({
        intentId: body.intentId,
        userId: user.id,
        paymentId: body.transactionHash,
      });
      return jsonOk(published);
    }

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
    try {
      assertIntentFulfillable(intent, user.id);
    } catch (error) {
      if (error instanceof AppError && error.code === ERROR_CODES.INTENT_EXPIRED) {
        await db
          .from("payment_intents")
          .update({ status: "expired" })
          .eq("id", intent.id)
          .eq("status", "created");
      }
      throw error;
    }

    if (event.phase !== "live") {
      await db.from("payment_failures").insert({
        payment_intent_id: intent.id,
        transaction_hash: body.transactionHash,
        reason_code: "event_closed",
      });
      throw new AppError(
        ERROR_CODES.EVENT_ENDED,
        "The Wall closed during checkout.",
        403,
      );
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

    if (!intent.claim_secret_hash) {
      throw new AppError(
        ERROR_CODES.INTENT_NOT_FOUND,
        "This checkout has no Wall Key. Start again — do not pay twice.",
      );
    }

    const { text } = await preflightMessage(intent.message_text);
    if (text !== intent.message_text) {
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
      throw mapPublishError(pubError.message);
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
