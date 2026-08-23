import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@/lib/errors";
import { consumeMemoryRateLimit, mapPublishError, resetMemoryRateLimits } from "@/lib/data/rate-limit";

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

describe("Vercel-style write shedding", () => {
  it("keeps the first N checkout attempts and 429s the rest in the same window", () => {
    resetMemoryRateLimits();
    let accepted = 0;
    let limited = 0;
    for (let i = 0; i < 25; i += 1) {
      try {
        consumeMemoryRateLimit("intent:ip:burst", 10, 60);
        accepted += 1;
      } catch (error) {
        expect((error as { code?: string }).code).toBe(ERROR_CODES.RATE_LIMITED);
        limited += 1;
      }
    }
    expect(accepted).toBe(10);
    expect(limited).toBe(15);
  });
});
