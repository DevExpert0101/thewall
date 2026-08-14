import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@/lib/errors";
import { mapPublishError } from "@/lib/data/rate-limit";

describe("write rejection mapping", () => {
  it("maps event_upcoming", () => {
    const err = mapPublishError("event_upcoming");
    expect(err.code).toBe(ERROR_CODES.EVENT_UPCOMING);
  });
  it("maps event_ended so post-close reactions/publishes fail", () => {
    const err = mapPublishError("event_ended");
    expect(err.code).toBe(ERROR_CODES.EVENT_ENDED);
  });
  it("maps duplicate reactions", () => {
    const err = mapPublishError("duplicate_reaction");
    expect(err.code).toBe(ERROR_CODES.DUPLICATE_REACTION);
  });
  it("maps reused transactions", () => {
    const err = mapPublishError("tx_already_used");
    expect(err.code).toBe(ERROR_CODES.TX_ALREADY_USED);
  });
  it("maps expired intents", () => {
    const err = mapPublishError("intent_expired");
    expect(err.code).toBe(ERROR_CODES.INTENT_EXPIRED);
  });
  it("maps missing confirmation on moderation", () => {
    const err = mapPublishError("confirmation_required");
    expect(err.code).toBe(ERROR_CODES.CONFIRMATION_REQUIRED);
  });
  it("maps a tampered checkout hash", () => {
    expect(mapPublishError("hash_mismatch").code).toBe(ERROR_CODES.HASH_MISMATCH);
  });
  it("maps frozen checkout terms", () => {
    expect(mapPublishError("intent_terms_frozen").code).toBe(ERROR_CODES.HASH_MISMATCH);
  });
});
