import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyAdminEventControl } from "@/lib/admin/event-control";
import {
  closeSimulatedWall,
  configureSimulatedWall,
  currentSimulatedEvent,
  listSimulatedEditions,
  moderateSimulatedMessage,
  resetSimulationState,
  startSimulatedWall,
} from "@/lib/data/simulation";
import { AppError } from "@/lib/errors";
import {
  addReactions,
  closeForReview,
  discloseResults,
  monumentCatalog,
  openShortLiveWall,
  payAndPublish,
} from "@/lib/testing/harness";

function liveWindow(hours = 23) {
  const now = Date.now();
  return {
    startsAt: new Date(now - 60_000).toISOString(),
    endsAt: new Date(now + hours * 60 * 60 * 1000).toISOString(),
  };
}

describe("admin wall control", () => {
  beforeEach(() => {
    resetSimulationState();
  });

  afterEach(() => {
    resetSimulationState();
  });

  it("saves title without moving the clock", async () => {
    configureSimulatedWall(liveWindow());
    const before = currentSimulatedEvent();
    const event = await applyAdminEventControl({
      action: "save",
      title: "STEWARD TITLE",
    });
    expect(event.title).toBe("STEWARD TITLE");
    expect(event.phase).toBe("live");
    expect(event.startsAt).toBe(before.startsAt);
    expect(event.endsAt).toBe(before.endsAt);
    expect(currentSimulatedEvent().title).toBe("STEWARD TITLE");
  });

  it("requires CLOCK before remaining time can change after launch", async () => {
    await expect(
      applyAdminEventControl({
        action: "save",
        remainingMinutes: 8,
      }),
    ).rejects.toBeInstanceOf(AppError);
    const event = await applyAdminEventControl({
      action: "save",
      remainingMinutes: 8,
      confirmHistoricalEdit: true,
      confirmText: "CLOCK",
    });
    expect(event.remainingMinutes).toBeGreaterThanOrEqual(7);
    expect(event.remainingMinutes).toBeLessThanOrEqual(8);
  });

  it("starts the next simulated day after a seal", async () => {
    closeSimulatedWall();
    const event = await applyAdminEventControl({
      action: "start",
      title: "DAY TWO",
      durationMinutes: 10,
    });
    expect(event.phase).toBe("live");
    expect(event.title).toBe("DAY TWO");
    expect(event.windowMinutes).toBe(10);
  });

  it("closes a live wall for review without disclosing results", async () => {
    const closed = await applyAdminEventControl({ action: "finish" });
    expect(closed.phase).toBe("finalizing");
    expect(listSimulatedEditions()).toHaveLength(0);
  });

  it("does not disclose an expired wall until finish is confirmed", async () => {
    startSimulatedWall({ title: "REVIEW DAY", durationMinutes: 5 });
    configureSimulatedWall({
      startsAt: "2026-08-15T01:00:00.000Z",
      endsAt: "2026-08-15T01:05:00.000Z",
    });
    expect(currentSimulatedEvent(new Date("2026-08-15T01:06:00.000Z")).phase).toBe("finalizing");
    expect(listSimulatedEditions()).toHaveLength(0);
    await expect(applyAdminEventControl({ action: "finish" })).rejects.toBeInstanceOf(AppError);
    expect(listSimulatedEditions()).toHaveLength(0);
    const finished = await applyAdminEventControl({
      action: "finish",
      confirm: true,
      confirmText: "FINISH",
    });
    expect(finished.phase).toBe("archived");
    expect(listSimulatedEditions()).toHaveLength(1);
    expect(listSimulatedEditions()[0]?.archiveHash).toMatch(/^[0-9a-f]{64}$/);
    expect(listSimulatedEditions()[0]?.merkleRoot).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses to rewrite a sealed Wall or its Victor through ordinary save", async () => {
    closeSimulatedWall();
    const first = listSimulatedEditions()[0];
    await expect(
      applyAdminEventControl({
        action: "save",
        title: "REPLACED VICTOR",
        themeQuestion: "hacked",
      }),
    ).rejects.toBeInstanceOf(AppError);
    expect(listSimulatedEditions()[0]?.winning?.publicNumber).toBe(first?.winning?.publicNumber);
    expect(listSimulatedEditions()[0]?.title).toBe(first?.title);
  });

  it("promotes the next living sentence when the leader is removed before Finish", async () => {
    openShortLiveWall();
    const living = payAndPublish("Still standing after review.");
    const illegal = payAndPublish("Illegal leader for review.");
    addReactions(living.messageId, 80);
    addReactions(illegal.messageId, 90);
    expect(closeForReview().phase).toBe("finalizing");
    moderateSimulatedMessage({ messageId: illegal.messageId, action: "remove" });
    const finished = await discloseResults();
    expect(finished.phase).toBe("archived");
    expect(listSimulatedEditions()[0]?.winning?.publicNumber).toBe(living.publicNumber);
    expect(listSimulatedEditions()[0]?.winning?.text).toBe(living.text);
    expect(monumentCatalog()[0]?.text).toBe(living.text);
    expect(monumentCatalog()[0]?.originalPublicNumber).toBe(living.publicNumber);
  });

  it("refuses to start the next day while the current wall is under review", async () => {
    startSimulatedWall({ title: "REVIEW DAY", durationMinutes: 5 });
    configureSimulatedWall({
      startsAt: "2026-08-15T01:00:00.000Z",
      endsAt: "2026-08-15T01:05:00.000Z",
    });
    await expect(applyAdminEventControl({ action: "start", title: "TOO SOON" })).rejects.toBeInstanceOf(
      AppError,
    );
    expect(listSimulatedEditions()).toHaveLength(0);
  });
});
