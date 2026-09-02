import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppError, ERROR_CODES } from "@/lib/errors";
import {
  createSimulatedIntent,
  currentSimulatedEvent,
  fulfillSimulatedPayment,
  simulatedMessageList,
} from "@/lib/data/simulation";
import { assignFinalRanks } from "@/lib/ranking";
import {
  addReactions,
  closeForReview,
  discloseResults,
  openShortLiveWall,
  payAndPublish,
  reactOnce,
  resetAutomatedWall,
} from "@/lib/testing/harness";
import { createWallKey, hashWallKey } from "@/lib/crypto";

afterEach(() => {
  resetAutomatedWall();
});

const ROOT = process.cwd();

function sql(file: string) {
  return readFileSync(join(ROOT, "supabase/migrations", file), "utf8");
}

function codeOf(fn: () => unknown) {
  try {
    fn();
  } catch (error) {
    return (error as AppError).code;
  }
  throw new Error("expected failure");
}

const TABLES = sql("20260813120001_tables.sql");
const INDEXES = sql("20260813120002_indexes.sql");
const FUNCS = sql("20260813120003_functions.sql");
const REACTIONS = sql("20260816150000_reaction_integrity.sql");
const VIRAL = sql("20260816160000_viral_load.sql");
const CLAIMS = sql("20260814120000_wall_key_claims.sql");
const LIVING = sql("20260822170000_living_victor.sql");
const RANK_COUNTS = sql("20260901180000_rank_and_reaction_integrity.sql");

describe("suite 31 — database integrity", () => {
  it("declares primary keys, uniques, and the write-path locks in SQL", () => {
    expect(TABLES).toContain("id uuid primary key");
    expect(TABLES).toMatch(/constraint events_slug_unique unique \(slug\)/);
    expect(TABLES).toMatch(/constraint messages_event_number unique \(event_id, public_number\)/);
    expect(TABLES).toMatch(/constraint messages_payment_intent unique \(payment_intent_id\)/);
    expect(TABLES).toMatch(/constraint payments_tx_hash unique \(transaction_hash\)/);
    expect(TABLES).toMatch(/constraint payments_intent_unique unique \(payment_intent_id\)/);
    expect(TABLES).toMatch(
      /constraint reactions_unique_user_message unique \(message_id, anonymous_user_id\)/,
    );
    expect(TABLES).toMatch(/constraint message_ownership_token_unique unique \(token_hash\)/);
    expect(TABLES).not.toMatch(/public_message_events_number_unique/);
    expect(FUNCS).toContain("for update");
    expect(FUNCS).toContain("publish_paid_message");
    expect(REACTIONS).toContain("reactions_user_idempotency_uidx");
    expect(VIRAL).toContain("reaction_count = reaction_count + 1");
    expect(RANK_COUNTS).toMatch(/unique \(event_id, final_rank\)/);
    expect(RANK_COUNTS).toContain("deferrable initially deferred");
    expect(RANK_COUNTS).toContain("reactions_sync_counts");
    expect(RANK_COUNTS).not.toContain("reaction_count = reaction_count + 1");
    expect(CLAIMS).toContain("create unique index if not exists message_claims_hash_idx");
    expect(LIVING).toContain("and removed_at is null");
    expect(INDEXES).toContain("messages_event_published_idx");
  });

  it("rejects duplicate numbers, ids, payments, and 🔥 at the application ledger", () => {
    openShortLiveWall();
    const first = payAndPublish("Integrity first sentence.");
    const second = payAndPublish("Integrity second sentence.");
    expect(first.publicNumber).not.toBe(second.publicNumber);
    expect(first.messageId).not.toBe(second.messageId);
    expect(first.paymentId).not.toBe(second.paymentId);

    const numbers = simulatedMessageList().map((row) => row.publicNumber);
    const ids = simulatedMessageList().map((row) => row.id);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(new Set(ids).size).toBe(ids.length);

    const replay = fulfillSimulatedPayment({
      intentId: first.intentId,
      userId: first.userId,
      paymentId: first.paymentId,
    });
    expect(replay.publicNumber).toBe(first.publicNumber);
    expect(replay.messageId).toBe(first.messageId);
    expect(replay.recovered).toBe(true);
    expect(simulatedMessageList().filter((row) => row.publicNumber === first.publicNumber)).toHaveLength(
      1,
    );

    const stranger = createSimulatedIntent({
      text: "Other checkout, stolen hash.",
      userId: "local-sim-stolen-hash",
      claimSecretHash: hashWallKey(createWallKey()),
    });
    expect(
      codeOf(() =>
        fulfillSimulatedPayment({
          intentId: stranger.intentId,
          userId: "local-sim-stolen-hash",
          paymentId: first.paymentId,
        }),
      ),
    ).toBe(ERROR_CODES.PAYMENT_FAILED);

    const fires = addReactions(first.messageId, 5);
    expect(fires).toBe(5);
    expect(codeOf(() => reactOnce(first.messageId, "local-sim-bulk-" + first.messageId + "-0"))).toBe(
      ERROR_CODES.DUPLICATE_REACTION,
    );
    expect(simulatedMessageList().find((row) => row.id === first.messageId)?.reactionCount).toBe(5);
  });

  it("keeps concurrent publishes and 🔥 consistent with the ledger", async () => {
    openShortLiveWall();
    const marks = await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        Promise.resolve(payAndPublish(`Concurrent integrity ${index}.`)),
      ),
    );
    const numbers = marks.map((row) => row.publicNumber);
    expect(new Set(numbers).size).toBe(40);
    expect(Math.min(...numbers)).toBe(19);
    expect(Math.max(...numbers)).toBe(58);

    const target = marks[0];
    expect(target).toBeDefined();
    if (!target) return;
    const counts = await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        Promise.resolve(reactOnce(target.messageId, `local-sim-fan-${index}`)),
      ),
    );
    expect(new Set(counts).size).toBe(25);
    expect(Math.max(...counts)).toBe(25);
    expect(simulatedMessageList().find((row) => row.id === target.messageId)?.reactionCount).toBe(25);
    expect(currentSimulatedEvent().totalMessages).toBe(58);
  });

  it("does not leave an orphan message or certificate after a failed or replayed pay", () => {
    openShortLiveWall();
    const userId = "local-sim-orphan";
    const wallKey = createWallKey();
    const checkout = createSimulatedIntent({
      text: "Will not publish this checkout.",
      userId,
      claimSecretHash: hashWallKey(wallKey),
    });
    expect(
      simulatedMessageList().some((row) => row.text === "Will not publish this checkout."),
    ).toBe(false);
    expect(
      codeOf(() =>
        fulfillSimulatedPayment({
          intentId: checkout.intentId,
          userId,
          paymentId: `0x${"ab".repeat(32)}`,
        }),
      ),
    ).toBe(ERROR_CODES.PAYMENT_FAILED);
    expect(
      simulatedMessageList().some((row) => row.text === "Will not publish this checkout."),
    ).toBe(false);

    const published = payAndPublish("Certificate owner sentence.");
    const again = fulfillSimulatedPayment({
      intentId: published.intentId,
      userId: published.userId,
      paymentId: published.paymentId,
    });
    expect(again.messageId).toBe(published.messageId);
    expect(simulatedMessageList().filter((row) => row.id === published.messageId)).toHaveLength(1);
  });

  it("assigns unique living ranks and leaves removed rows unranked", async () => {
    openShortLiveWall();
    const quiet = payAndPublish("Quiet rank sentence.");
    const loud = payAndPublish("Loud rank sentence.");
    addReactions(loud.messageId, 12);
    addReactions(quiet.messageId, 3);

    const live = assignFinalRanks(simulatedMessageList());
    const ranks = live.filter((row) => row.finalRank != null).map((row) => row.finalRank);
    expect(new Set(ranks).size).toBe(ranks.length);
    const loudRank = live.find((row) => row.publicNumber === loud.publicNumber)?.finalRank;
    const quietRank = live.find((row) => row.publicNumber === quiet.publicNumber)?.finalRank;
    expect(loudRank).toBeTruthy();
    expect(quietRank).toBeTruthy();
    expect((loudRank ?? 99) < (quietRank ?? 0)).toBe(true);
    expect(live.filter((row) => row.finalRank === 1)).toHaveLength(1);

    closeForReview();
    const sealed = await discloseResults();
    expect(sealed.phase).toBe("archived");
    const archived = assignFinalRanks(
      simulatedMessageList().map((row) =>
        row.publicNumber === quiet.publicNumber ? { ...row, isRemoved: true } : row,
      ),
    );
    expect(archived.find((row) => row.publicNumber === quiet.publicNumber)?.finalRank).toBeNull();
    expect(archived.filter((row) => row.finalRank === 1)).toHaveLength(1);
    const livingRanks = archived
      .filter((row) => row.finalRank != null)
      .map((row) => row.finalRank as number)
      .sort((a, b) => a - b);
    expect(livingRanks[0]).toBe(1);
    expect(new Set(livingRanks).size).toBe(livingRanks.length);
  });

  it("keeps ranks unique and 🔥 counts tied to reaction rows in SQL", () => {
    expect(RANK_COUNTS).toContain("messages_event_rank_unique");
    expect(RANK_COUNTS).toContain("count(*)::integer from public.reactions");
    expect(RANK_COUNTS).toContain("add_fire_reaction");
    expect(TABLES).toMatch(/payment_intent_id uuid references public.payment_intents \(id\)/);
    expect(TABLES).not.toMatch(
      /create table public.payment_failures[\s\S]*payment_intent_id uuid not null/,
    );
    expect(CLAIMS).toContain("message_id uuid references public.messages (id)");
    expect(VIRAL).not.toContain("for update");
  });
});
