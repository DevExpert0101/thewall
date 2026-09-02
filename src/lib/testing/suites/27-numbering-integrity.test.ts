import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createWallKey, hashWallKey } from "@/lib/crypto";
import { AppError, ERROR_CODES } from "@/lib/errors";
import {
  createSimulatedIntent,
  fulfillSimulatedPayment,
  simulatedMessageList,
} from "@/lib/data/simulation";
import {
  closeForReview,
  createUnpaidIntent,
  openShortLiveWall,
  payAndPublish,
  resetAutomatedWall,
} from "@/lib/testing/harness";

afterEach(() => {
  resetAutomatedWall();
});

function codeOf(fn: () => unknown) {
  try {
    fn();
  } catch (error) {
    return (error as AppError).code;
  }
  throw new Error("expected failure");
}

function scanNumbers(numbers: number[]) {
  const seen = new Set<number>();
  let firstDuplicate: number | null = null;
  for (const n of numbers) {
    if (seen.has(n) && firstDuplicate == null) firstDuplicate = n;
    seen.add(n);
  }
  const sorted = [...seen].sort((a, b) => a - b);
  let firstMissing: number | null = null;
  if (sorted.length > 0) {
    const start = sorted[0] ?? 1;
    const end = sorted[sorted.length - 1] ?? start;
    for (let n = start; n <= end; n += 1) {
      if (!seen.has(n)) {
        firstMissing = n;
        break;
      }
    }
  }
  return { firstDuplicate, firstMissing, unique: seen.size, count: numbers.length };
}

function assertLedger(extraCount: number) {
  const extras = simulatedMessageList()
    .filter((row) => row.publicNumber > 18)
    .map((row) => row.publicNumber);
  const all = simulatedMessageList().map((row) => row.publicNumber);
  const extraScan = scanNumbers(extras);
  const allScan = scanNumbers(all);
  expect(extraScan.firstDuplicate, "first duplicate extra").toBeNull();
  expect(extraScan.firstMissing, "first missing extra").toBeNull();
  expect(extraScan.unique).toBe(extraCount);
  expect(allScan.firstDuplicate, "first duplicate on wall").toBeNull();
  expect(allScan.firstMissing, "first missing on wall").toBeNull();
  expect(allScan.unique).toBe(all.length);
  expect(Math.min(...extras)).toBe(19);
  expect(Math.max(...extras)).toBe(18 + extraCount);
}

describe("suite 27 — message number integrity", () => {
  it.each([10, 100, 1_000, 10_000])(
    "assigns unique sequential numbers to %s publishes",
    (count) => {
      openShortLiveWall();
      const marks = Array.from({ length: count }, (_, index) =>
        payAndPublish(`Integrity sentence ${count}-${index}.`),
      );
      expect(marks).toHaveLength(count);
      expect(new Set(marks.map((mark) => mark.messageId)).size).toBe(count);
      expect(new Set(marks.map((mark) => mark.publicNumber)).size).toBe(count);
      assertLedger(count);
    },
    180_000,
  );

  it("replays duplicate verify, refresh, and network retry onto one number", async () => {
    openShortLiveWall();
    const unpaid = createUnpaidIntent("One payment, many retries.");
    const first = fulfillSimulatedPayment({
      intentId: unpaid.checkout.intentId,
      userId: unpaid.userId,
      paymentId: unpaid.checkout.simulatedPaymentId,
    });
    const retries = await Promise.all(
      [1, 2, 3, 4, 5].map(() =>
        Promise.resolve().then(() =>
          fulfillSimulatedPayment({
            intentId: unpaid.checkout.intentId,
            userId: unpaid.userId,
            paymentId: unpaid.checkout.simulatedPaymentId,
          }),
        ),
      ),
    );
    expect(retries.every((row) => row.publicNumber === first.publicNumber)).toBe(true);
    expect(retries.every((row) => row.messageId === first.messageId)).toBe(true);
    expect(retries.every((row) => row.recovered === true)).toBe(true);
    expect(simulatedMessageList().filter((row) => row.text === unpaid.text)).toHaveLength(1);
    assertLedger(1);
  });

  it("does not mint a second number when the same sentence is paid again", () => {
    openShortLiveWall();
    const mark = payAndPublish("Retry must not carve twice.");
    expect(codeOf(() => payAndPublish(mark.text))).toBe(ERROR_CODES.MODERATION_REJECTED);
    expect(simulatedMessageList().filter((row) => row.text === mark.text)).toHaveLength(1);
    assertLedger(1);
  });

  it("does not consume a number when moderation or a bad payment fails", () => {
    openShortLiveWall();
    expect(codeOf(() => payAndPublish("a".repeat(50)))).toBe(ERROR_CODES.MODERATION_REJECTED);
    const bad = createUnpaidIntent("Wrong hash then a real publish.");
    expect(
      codeOf(() =>
        fulfillSimulatedPayment({
          intentId: bad.checkout.intentId,
          userId: bad.userId,
          paymentId: `0x${"cd".repeat(32)}`,
        }),
      ),
    ).toBe(ERROR_CODES.PAYMENT_FAILED);
    const ok = payAndPublish("After the failed attempts.");
    expect(ok.publicNumber).toBe(19);
    assertLedger(1);
  });

  it("does not consume a number when payment confirms after close", () => {
    openShortLiveWall();
    const inFlight = createUnpaidIntent("Paid after the bell.");
    closeForReview();
    expect(
      codeOf(() =>
        fulfillSimulatedPayment({
          intentId: inFlight.checkout.intentId,
          userId: inFlight.userId,
          paymentId: inFlight.checkout.simulatedPaymentId,
        }),
      ),
    ).toBe(ERROR_CODES.PAID_AFTER_CLOSE);
    expect(simulatedMessageList().some((row) => row.text === inFlight.text)).toBe(false);
    const extras = simulatedMessageList().filter((row) => row.publicNumber > 18);
    expect(extras).toHaveLength(0);
  });

  it("assigns distinct numbers when many unpaid intents confirm together", async () => {
    openShortLiveWall();
    const checkouts = Array.from({ length: 40 }, (_, index) =>
      createUnpaidIntent(`Burst confirm ${index}.`, `burst-${index}`),
    );
    const published = await Promise.all(
      checkouts.map((row) =>
        Promise.resolve().then(() =>
          fulfillSimulatedPayment({
            intentId: row.checkout.intentId,
            userId: row.userId,
            paymentId: row.checkout.simulatedPaymentId,
          }),
        ),
      ),
    );
    expect(new Set(published.map((row) => row.publicNumber)).size).toBe(40);
    expect(new Set(published.map((row) => row.messageId)).size).toBe(40);
    assertLedger(40);
  });

  it("keeps one number per intent after a process-local restart of the ledger", () => {
    openShortLiveWall();
    const first = payAndPublish("Survives the next handler.");
    const second = payAndPublish("Next handler continues the series.");
    expect(second.publicNumber).toBe(first.publicNumber + 1);
    const again = fulfillSimulatedPayment({
      intentId: first.intentId,
      userId: first.userId,
      paymentId: first.paymentId,
    });
    expect(again.publicNumber).toBe(first.publicNumber);
    expect(again.recovered).toBe(true);
    assertLedger(2);
  });

  it("locks allocation in SQL behind FOR UPDATE and UNIQUE (event_id, public_number)", () => {
    const tables = readFileSync(join(process.cwd(), "supabase/migrations/20260813120001_tables.sql"), "utf8");
    const rpc = readFileSync(join(process.cwd(), "supabase/migrations/20260814120000_wall_key_claims.sql"), "utf8");
    expect(tables).toContain("constraint messages_event_number unique (event_id, public_number)");
    expect(tables).toContain("constraint messages_payment_intent unique (payment_intent_id)");
    expect(rpc).toMatch(/from public\.event_counters[\s\S]*for update/i);
    expect(rpc).toMatch(/next_message_number = next_message_number \+ 1/);
    expect(rpc.indexOf("next_message_number = next_message_number + 1")).toBeLessThan(
      rpc.indexOf("insert into public.messages"),
    );
  });

  it("does not let a second intent steal an already published number", () => {
    openShortLiveWall();
    const a = payAndPublish("Number owner.");
    const b = createSimulatedIntent({
      text: "Different sentence.",
      userId: "other",
      claimSecretHash: hashWallKey(createWallKey()),
    });
    const published = fulfillSimulatedPayment({
      intentId: b.intentId,
      userId: "other",
      paymentId: b.simulatedPaymentId,
    });
    expect(published.publicNumber).not.toBe(a.publicNumber);
    expect(published.publicNumber).toBe(a.publicNumber + 1);
    assertLedger(2);
  });
});
