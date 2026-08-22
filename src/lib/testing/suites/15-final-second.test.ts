import { afterEach, describe, expect, it } from "vitest";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { assertReactOpen } from "@/lib/event/state";
import { addSimulatedReaction } from "@/lib/data/simulation";
import {
  addReactions,
  monumentCatalog,
  openShortLiveWall,
  payAndPublish,
  resetAutomatedWall,
  sealAutomatedWall,
} from "@/lib/testing/harness";
import { configureSimulatedWall, currentSimulatedEvent } from "@/lib/data/simulation";

afterEach(() => {
  resetAutomatedWall();
});

describe("suite 15 — final second", () => {
  it("keeps #1 at 1000 vs 999 and only accepts 🔥 before ends_at", () => {
    for (let round = 0; round < 3; round += 1) {
      openShortLiveWall(5);
      const first = payAndPublish(`Final-second leader ${round}.`);
      const chase = payAndPublish(`Final-second chase ${round}.`);
      addReactions(first.messageId, 1000);
      addReactions(chase.messageId, 999);
      const endsAt = new Date(Date.now() + 10_000).toISOString();
      configureSimulatedWall({ endsAt });
      const event = currentSimulatedEvent();
      const tMinus = new Date(Date.parse(endsAt) - 100);
      const tPlus = new Date(Date.parse(endsAt) + 100);
      expect(() => assertReactOpen({ phase: "live", endsAt: event.endsAt }, undefined, tMinus)).not.toThrow();
      addSimulatedReaction(chase.messageId, `late-burst-${round}`, undefined, tMinus);
      expect(() => assertReactOpen({ phase: "live", endsAt: event.endsAt }, undefined, tPlus)).toThrow(AppError);
      try {
        addSimulatedReaction(chase.messageId, `after-bell-${round}`, undefined, tPlus);
        throw new Error("late reaction accepted");
      } catch (error) {
        expect((error as AppError).code).toBe(ERROR_CODES.EVENT_ENDED);
      }
      sealAutomatedWall();
      expect(monumentCatalog()[0]?.text).toBe(first.text);
      resetAutomatedWall();
    }
  });
});
