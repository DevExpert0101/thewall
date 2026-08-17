import { afterEach, describe, expect, it } from "vitest";
import { createWallKey, hashWallKey } from "@/lib/crypto";
import {
  addSimulatedReaction,
  closeSimulatedWall,
  createSimulatedIntent,
  fulfillSimulatedPayment,
  listSimulatedMonumentEntries,
  resetSimulationState,
} from "@/lib/data/simulation";
import { verifyMessageClaim } from "@/lib/ownership/claim";
import { AppError } from "@/lib/errors";

afterEach(() => {
  resetSimulationState();
});

describe("Victor ownership", () => {
  it("lets the original Wall Key prove the Victor and keeps The Monument anonymous", async () => {
    const wallKey = createWallKey();
    const checkout = createSimulatedIntent({
      text: "A sentence that will stand first.",
      userId: "local-sim",
      claimSecretHash: hashWallKey(wallKey),
    });
    const published = fulfillSimulatedPayment({
      intentId: checkout.intentId,
      userId: "local-sim",
      paymentId: checkout.simulatedPaymentId,
    });
    for (let i = 0; i < 80; i += 1) {
      addSimulatedReaction(published.messageId, `victor-reactor-${i}`);
    }
    closeSimulatedWall();
    const claim = await verifyMessageClaim({
      eventId: "local",
      publicNumber: published.publicNumber,
      wallKey,
    });
    expect(claim.messageId).toBeTruthy();
    expect(claim.won).toBe(true);
    const monument = listSimulatedMonumentEntries();
    expect(monument[0]?.originalPublicNumber).toBe(published.publicNumber);
    expect(JSON.stringify(monument)).not.toMatch(/wall key|wallet|0x|owner|email/i);
    await expect(
      verifyMessageClaim({
        eventId: "local",
        publicNumber: published.publicNumber,
        wallKey: createWallKey(),
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
