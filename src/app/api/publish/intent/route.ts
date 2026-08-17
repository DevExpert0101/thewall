import { PAYMENT_INTENT_TTL_SECONDS, PRICE_USDC } from "@/lib/constants";
import { createWallKey, hashWallKey } from "@/lib/crypto";
import { protectAnonymousWrite } from "@/lib/abuse/protect";
import { eventSlug, getEventOps, getEventSnapshot } from "@/lib/data/event";
import { assertNotSimulatedInProduction, createSimulatedIntent, isSimulationEvent } from "@/lib/data/simulation";
import { getNetwork, getTreasuryAddress, isSimulation } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { assertPublishOpen } from "@/lib/event/state";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { bindMessageHash } from "@/lib/payment/fulfillment";
import { preflightMessage } from "@/lib/publish/preflight";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { composeSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = composeSchema.parse(await readJson(request));
    const user = await protectAnonymousWrite({
      request,
      action: "intent",
      turnstileToken: body.turnstileToken,
    });

    const { text, moderationStatus, decision } = await preflightMessage(body.message);

    const event = await getEventSnapshot(eventSlug());
    const ops = await getEventOps();
    assertNotSimulatedInProduction(event.id);
    assertPublishOpen(event, ops);

    const wallKey = createWallKey();
    const claimSecretHash = hashWallKey(wallKey);

    if (isSimulation() || isSimulationEvent(event.id)) {
      const checkout = createSimulatedIntent({
        text,
        userId: user.id,
        claimSecretHash,
      });
      return jsonOk({
        intentId: checkout.intentId,
        wallKey,
        amount: checkout.amount,
        currency: checkout.currency,
        network: checkout.network,
        recipient: checkout.recipient,
        expiresAt: checkout.expiresAt,
        messageHash: checkout.messageHash,
        messagePreview: text,
        decision,
        moderationStatus,
        testnet: checkout.network === "base-sepolia",
        simulated: true,
        simulatedPaymentId: checkout.simulatedPaymentId,
      });
    }

    const ttl =
      Number(process.env.PAYMENT_INTENT_TTL_SECONDS) || PAYMENT_INTENT_TTL_SECONDS;
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    const recipient = getTreasuryAddress().toLowerCase() as `0x${string}`;
    const network = getNetwork();
    const messageHash = bindMessageHash(text);

    const db = createServiceSupabase();
    const { data, error } = await db
      .from("payment_intents")
      .insert({
        event_id: event.id,
        anonymous_user_id: user.id,
        message_text: text,
        message_hash: messageHash,
        claim_secret_hash: claimSecretHash,
        amount: PRICE_USDC,
        currency: "USDC",
        network,
        recipient_wallet: recipient,
        status: "created",
        expires_at: expiresAt,
      })
      .select("id, expires_at")
      .single();

    if (error || !data) {
      throw new AppError(ERROR_CODES.UNAVAILABLE, "Could not create payment intent.", 503);
    }

    return jsonOk({
      intentId: data.id,
      wallKey,
      amount: PRICE_USDC,
      currency: "USDC",
      network,
      recipient,
      expiresAt: data.expires_at,
      messageHash,
      messagePreview: text,
      decision,
      moderationStatus,
      testnet: network === "base-sepolia",
    });
  } catch (error) {
    return jsonError(error);
  }
}
