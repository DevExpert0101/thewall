import { afterEach, describe, expect, it } from "vitest";
import { applyAdminEventControl } from "@/lib/admin/event-control";
import {
  closeSimulatedWall,
  configureSimulatedWall,
  currentSimulatedEvent,
  listSimulatedEditions,
  resetSimulationState,
  startSimulatedWall,
} from "@/lib/data/simulation";
import { AppError } from "@/lib/errors";

describe("admin wall control", () => {
  afterEach(() => {
    resetSimulationState();
  });

  it("saves title without moving the clock", async () => {
    configureSimulatedWall({
      startsAt: "2026-08-16T00:00:00.000Z",
      endsAt: "2026-08-17T00:00:00.000Z",
    });
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
