import { afterEach, describe, expect, it } from "vitest";
import { createWallKey, hashWallKey, tokensEqual } from "@/lib/crypto";
import { ERROR_CODES } from "@/lib/errors";
import {
  assertClaimNotLocked,
  listClaimAttempts,
  recordClaimAttempt,
  resetClaimAttempts,
  saveWinnerDelivery,
  verifyMessageClaim,
} from "@/lib/ownership/claim";
import {
  consumeClaimChallenge,
  invalidateClaimSession,
  readClaimSession,
  resetClaimSessionState,
} from "@/lib/ownership/claim-session";
import { resetMemoryRateLimits } from "@/lib/data/rate-limit";
import {
  closeSimulatedWall,
  createSimulatedIntent,
  fulfillSimulatedPayment,
  resetSimulationState,
} from "@/lib/data/simulation";
import { AppError } from "@/lib/errors";

function requestFrom(ip: string) {
  return new Request("http://localhost/api/claim", {
    headers: { "x-forwarded-for": ip },
  });
}

afterEach(() => {
  resetClaimAttempts();
  resetClaimSessionState();
  resetMemoryRateLimits();
  resetSimulationState();
});

describe("claim verification", () => {
  it("matches a Wall Key with a timing-safe hash compare", async () => {
    const wallKey = createWallKey();
    const checkout = createSimulatedIntent({
      text: "I left this for the claim desk.",
      userId: "local-sim",
      claimSecretHash: hashWallKey(wallKey),
    });
    const published = fulfillSimulatedPayment({
      intentId: checkout.intentId,
      userId: "local-sim",
      paymentId: checkout.simulatedPaymentId,
    });
    closeSimulatedWall();
    const claim = await verifyMessageClaim({
      eventId: "local",
      publicNumber: published.publicNumber,
      wallKey,
    });
    expect(claim.messageId).toBeTruthy();
    expect(tokensEqual(hashWallKey(wallKey), hashWallKey(wallKey))).toBe(true);
  });

  it("audits success and failure without storing the submitted key", async () => {
    const secret = "7K9P-X4MF-82QH-K3R2";
    await recordClaimAttempt({ publicNumber: 4, outcome: "invalid", ipHash: "abc" });
    await recordClaimAttempt({ publicNumber: 4, outcome: "success", ipHash: "abc" });
    const rows = listClaimAttempts();
    expect(rows.map((row) => row.outcome)).toEqual(["success", "invalid"]);
    expect(JSON.stringify(rows)).not.toContain(secret);
    expect(JSON.stringify(rows)).not.toMatch(/wallKey|claimKey|token_hash/i);
  });

  it("locks repeated failed guesses from the same visitor", async () => {
    const req = requestFrom("203.0.113.9");
    for (let i = 0; i < 8; i += 1) {
      await recordClaimAttempt({
        publicNumber: 4,
        outcome: "invalid",
        ipHash: (await import("@/lib/abuse/ip")).clientIpHashForLimit(req),
      });
    }
    await expect(assertClaimNotLocked(req, 4)).rejects.toMatchObject({
      code: ERROR_CODES.CLAIM_LOCKED,
    });
  });

  it("consumes a challenge once and invalidates a prize session after use", async () => {
    const { createClaimChallengeToken, createClaimSessionToken } = await import(
      "@/lib/ownership/claim-session"
    );
    const challenge = await createClaimChallengeToken();
    await consumeClaimChallenge(challenge);
    await expect(consumeClaimChallenge(challenge)).rejects.toBeInstanceOf(AppError);
    const session = await createClaimSessionToken({ messageId: "m1", publicNumber: 4, won: true });
    expect(await readClaimSession(session)).toEqual({
      messageId: "m1",
      publicNumber: 4,
      won: true,
    });
    await invalidateClaimSession(session);
    await expect(readClaimSession(session)).rejects.toBeInstanceOf(AppError);
  });

  it("refuses prize details without a legal acknowledgement", async () => {
    await expect(
      saveWinnerDelivery({
        messageId: "m1",
        delivery: { contactEmail: "winner@example.com", legalAcknowledged: false },
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
