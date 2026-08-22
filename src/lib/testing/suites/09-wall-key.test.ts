import { afterEach, describe, expect, it } from "vitest";
import { createWallKey } from "@/lib/crypto";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { assertClaimNotLocked, recordClaimAttempt } from "@/lib/ownership/claim";
import { resetClaimAttempts } from "@/lib/ownership/claim";
import { resetClaimSessionState } from "@/lib/ownership/claim-session";
import { clientIpHashForLimit } from "@/lib/abuse/ip";
import { getPublicEnv } from "@/lib/env";
import {
  claimWithKey,
  openShortLiveWall,
  payAndPublish,
  resetAutomatedWall,
  sealAutomatedWall,
} from "@/lib/testing/harness";
import { listSimulatedMessages } from "@/lib/data/simulation";

afterEach(() => {
  resetAutomatedWall();
  resetClaimAttempts();
  resetClaimSessionState();
});

describe("suite 9 — Wall Key ownership", () => {
  it("accepts only the exact key", () => {
    openShortLiveWall();
    const mark = payAndPublish("Owned sentence.");
    sealAutomatedWall();
    expect(claimWithKey(mark.publicNumber, mark.wallKey).messageId).toBeTruthy();
    expect(() => claimWithKey(mark.publicNumber, createWallKey())).toThrow(AppError);
    expect(() => claimWithKey(mark.publicNumber, `${mark.wallKey}x`)).toThrow(AppError);
    expect(() => claimWithKey(mark.publicNumber, "")).toThrow(AppError);
    expect(() => claimWithKey(mark.publicNumber, "not-a-key")).toThrow(AppError);
  });

  it("locks rapid failed guesses", async () => {
    const req = new Request("http://localhost/api/claim", {
      headers: { "x-forwarded-for": "203.0.113.44" },
    });
    const ipHash = clientIpHashForLimit(req);
    for (let i = 0; i < 8; i += 1) {
      await recordClaimAttempt({ publicNumber: 4, outcome: "invalid", ipHash });
    }
    await expect(assertClaimNotLocked(req, 4)).rejects.toMatchObject({
      code: ERROR_CODES.CLAIM_LOCKED,
    });
  });

  it("never puts the raw key on public surfaces", () => {
    openShortLiveWall();
    const mark = payAndPublish("Private ownership.");
    const publicJson = JSON.stringify({
      env: getPublicEnv(),
      messages: listSimulatedMessages({ sort: "new", limit: 40 }).messages,
    });
    expect(publicJson).not.toContain(mark.wallKey);
    expect(publicJson).not.toMatch(/claimSecretHash|SERVICE_ROLE|token_hash/i);
  });
});
