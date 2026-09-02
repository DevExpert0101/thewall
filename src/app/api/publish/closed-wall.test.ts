import { afterEach, describe, expect, it } from "vitest";
import { POST as intentPost } from "@/app/api/publish/intent/route";
import { POST as verifyPost } from "@/app/api/publish/verify/route";
import { POST as reactPost } from "@/app/api/react/route";
import { POST as preflightPost } from "@/app/api/publish/preflight/route";
import { ERROR_CODES } from "@/lib/errors";
import { createWallKey, hashWallKey } from "@/lib/crypto";
import { createSimulatedIntent } from "@/lib/data/simulation";
import {
  closeForReview,
  discloseResults,
  openShortLiveWall,
  payAndPublish,
  resetAutomatedWall,
} from "@/lib/testing/harness";

afterEach(() => {
  resetAutomatedWall();
});

const TOKEN = "1x00000000000000000000AA";

async function jsonOf(response: Response) {
  return { status: response.status, body: (await response.json()) as { code?: string } };
}

function intentRequest() {
  return new Request("http://localhost/api/publish/intent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: "After close this must not carve.",
      turnstileToken: TOKEN,
    }),
  });
}

describe("sealed-wall write APIs", () => {
  it("returns closed-wall codes instead of a generic 500", async () => {
    openShortLiveWall();
    const mark = payAndPublish("Keep this sentence for a closed-wall probe.");
    await discloseResults();

    const preflight = await jsonOf(await preflightPost(intentRequest()));
    expect(preflight.status).toBe(403);
    expect(preflight.body.code).toBe(ERROR_CODES.EVENT_ENDED);

    const intent = await jsonOf(await intentPost(intentRequest()));
    expect(intent.status).toBe(403);
    expect(intent.body.code).toBe(ERROR_CODES.EVENT_ENDED);

    const react = await jsonOf(
      await reactPost(
        new Request("http://localhost/api/react", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messageId: mark.messageId, turnstileToken: TOKEN }),
        }),
      ),
    );
    expect(react.status).toBe(403);
    expect(react.body.code).toBe(ERROR_CODES.EVENT_ENDED);

    const verify = await jsonOf(
      await verifyPost(
        new Request("http://localhost/api/publish/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            intentId: "11111111-1111-4111-8111-111111111111",
            transactionHash: `0x${"ab".repeat(32)}`,
          }),
        }),
      ),
    );
    expect(verify.status).not.toBe(500);
    expect(verify.body.code).not.toBe(ERROR_CODES.UNAVAILABLE);
    expect([
      ERROR_CODES.INTENT_NOT_FOUND,
      ERROR_CODES.EVENT_ENDED,
      ERROR_CODES.PAID_AFTER_CLOSE,
    ]).toContain(verify.body.code);
  });

  it("rejects a matching simulated payment after review close as paid-after-close", async () => {
    openShortLiveWall();
    const checkout = createSimulatedIntent({
      text: "Late unpaid must not publish.",
      userId: "local-sim",
      claimSecretHash: hashWallKey(createWallKey()),
    });
    closeForReview();

    const verify = await jsonOf(
      await verifyPost(
        new Request("http://localhost/api/publish/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            intentId: checkout.intentId,
            transactionHash: checkout.simulatedPaymentId,
          }),
        }),
      ),
    );
    expect(verify.body.code).toBe(ERROR_CODES.PAID_AFTER_CLOSE);
    expect(verify.status).not.toBe(500);
  });
});

