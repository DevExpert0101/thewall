import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPublicEnv } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { assignFinalRanks } from "@/lib/ranking";
import {
  claimWithKey,
  closeForReview,
  discloseResults,
  monumentCatalog,
  openAutomatedWall,
  openNextAutomatedWall,
  payAndPublish,
  reactOnce,
  resetAutomatedWall,
  sealAutomatedWall,
} from "@/lib/testing/harness";
import {
  createSimulatedIntent,
  currentSimulatedEvent,
  fulfillSimulatedPayment,
  getSimulatedMessage,
  listSimulatedMessages,
  simulatedMessageList,
} from "@/lib/data/simulation";
import { createWallKey, hashWallKey } from "@/lib/crypto";

beforeEach(() => {
  openAutomatedWall();
});

afterEach(() => {
  resetAutomatedWall();
});

describe("PAYMENT", () => {
  it("creates at most one sentence from one valid payment", () => {
    const mark = payAndPublish();
    const again = fulfillSimulatedPayment({
      intentId: mark.intentId,
      userId: mark.userId,
      paymentId: mark.paymentId,
    });
    expect(again.publicNumber).toBe(mark.publicNumber);
    expect(again.messageId).toBe(mark.messageId);
    expect(again.recovered).toBe(true);
    const copies = simulatedMessageList().filter((row) => row.text === mark.text);
    expect(copies).toHaveLength(1);
  });
});

describe("MESSAGE NUMBER", () => {
  it("never assigns the same public number to two writes on one Wall", () => {
    const first = payAndPublish();
    const second = payAndPublish();
    expect(first.publicNumber).not.toBe(second.publicNumber);
    const numbers = simulatedMessageList().map((row) => row.publicNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});

describe("REACTION", () => {
  it("refuses a second 🔥 from the same identity", () => {
    const mark = payAndPublish();
    const visitor = "local-sim-same-reactor";
    expect(reactOnce(mark.messageId, visitor)).toBeGreaterThan(0);
    expect(() => reactOnce(mark.messageId, visitor)).toThrow(AppError);
    try {
      reactOnce(mark.messageId, visitor);
    } catch (error) {
      expect((error as AppError).code).toBe(ERROR_CODES.DUPLICATE_REACTION);
    }
  });
});

describe("DEADLINE", () => {
  it("accepts no new sentence or reaction after ends_at", () => {
    const mark = payAndPublish();
    expect(closeForReview().phase).toBe("finalizing");
    const wallKey = createWallKey();
    expect(() =>
      createSimulatedIntent({
        text: "This arrives after the clock.",
        userId: "local-sim-late",
        claimSecretHash: hashWallKey(wallKey),
      }),
    ).toThrow(AppError);
    expect(() => reactOnce(mark.messageId, "local-sim-late-fire")).toThrow(AppError);
  });
});

describe("WINNER", () => {
  it("picks The Victor from authoritative final 🔥, then publish time, then number", () => {
    const mark = payAndPublish("This sentence should win the QA wall.");
    for (let i = 0; i < 70; i += 1) reactOnce(mark.messageId, `local-sim-victor-fire-${i}`);
    const ranked = assignFinalRanks(simulatedMessageList()).filter((row) => row.finalRank != null);
    const victor = ranked.reduce((best, row) => ((row.finalRank ?? 0) < (best.finalRank ?? 0) ? row : best));
    expect(victor.text).toBe(mark.text);
    expect(victor.reactionCount).toBeGreaterThan(67);
    sealAutomatedWall();
    const carved = monumentCatalog();
    expect(carved).toHaveLength(1);
    expect(carved[0]?.text).toBe(mark.text);
    expect(carved[0]?.originalPublicNumber).toBe(mark.publicNumber);
  });
});

describe("PERMANENT CANVAS", () => {
  it("carves exactly one winning sentence when a Wall is disclosed", async () => {
    const mark = payAndPublish("Only this QA victor should be carved.");
    for (let i = 0; i < 70; i += 1) reactOnce(mark.messageId, `local-sim-carve-fire-${i}`);
    const sealed = await discloseResults();
    expect(sealed.phase).toBe("archived");
    expect(monumentCatalog()).toHaveLength(1);
    expect(monumentCatalog()[0]?.text).toBe(mark.text);
    await discloseResults().catch(() => undefined);
    expect(monumentCatalog()).toHaveLength(1);
  });
});

describe("PERMANENT POSITION", () => {
  it("never reuses a consumed Monument plot", () => {
    payAndPublish();
    sealAutomatedWall();
    const first = monumentCatalog()[0];
    openNextAutomatedWall("QA WALL TWO");
    payAndPublish();
    sealAutomatedWall();
    const entries = monumentCatalog();
    expect(entries).toHaveLength(2);
    expect(entries[0]?.position).not.toBe(entries[1]?.position);
    expect(entries[0]?.x === entries[1]?.x && entries[0]?.y === entries[1]?.y).toBe(false);
    expect(first?.position).toBe(entries[0]?.position);
  });
});

describe("IMMUTABILITY", () => {
  it("does not move or rewrite an existing permanent sentence", () => {
    const firstMark = payAndPublish("First sealed QA sentence.");
    for (let i = 0; i < 70; i += 1) reactOnce(firstMark.messageId, `local-sim-immut-a-${i}`);
    sealAutomatedWall();
    const before = structuredClone(monumentCatalog()[0]);
    openNextAutomatedWall("QA WALL THREE");
    const later = payAndPublish("Second sealed QA sentence.");
    for (let i = 0; i < 70; i += 1) reactOnce(later.messageId, `local-sim-immut-b-${i}`);
    sealAutomatedWall();
    const first = monumentCatalog().find((row) => row.originalPublicNumber === firstMark.publicNumber);
    expect(first?.text).toBe(before?.text);
    expect(first?.sentenceSnapshot).toBe(before?.sentenceSnapshot);
    expect(first?.x).toBe(before?.x);
    expect(first?.y).toBe(before?.y);
    expect(first?.position).toBe(before?.position);
  });
});

describe("OWNERSHIP", () => {
  it("accepts the matching Wall Key and rejects any other", () => {
    const mark = payAndPublish();
    sealAutomatedWall();
    const claim = claimWithKey(mark.publicNumber, mark.wallKey);
    expect(claim.messageId).toBeTruthy();
    expect(() => claimWithKey(mark.publicNumber, createWallKey())).toThrow(AppError);
    expect(getSimulatedMessage(mark.publicNumber).text).toBe(mark.text);
  });
});

describe("PRIVACY", () => {
  it("keeps payment and ownership secrets off the public surface", () => {
    const mark = payAndPublish();
    const published = JSON.stringify(listSimulatedMessages({ sort: "new", limit: 40 }).messages);
    const env = JSON.stringify(getPublicEnv());
    const event = JSON.stringify(currentSimulatedEvent());
    for (const payload of [published, env, event]) {
      expect(payload).not.toContain(mark.wallKey);
      expect(payload).not.toMatch(/SERVICE_ROLE|claimSecretHash|token_hash|sk_live/i);
    }
  });
});
