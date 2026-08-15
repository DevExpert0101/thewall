import { afterEach, describe, expect, it } from "vitest";
import { applyAdminEventControl } from "@/lib/admin/event-control";
import { closeSimulatedWall, currentSimulatedEvent, resetSimulationState } from "@/lib/data/simulation";

describe("admin wall control", () => {
  afterEach(() => {
    resetSimulationState();
  });

  it("saves title and remaining time on the simulated wall", async () => {
    const event = await applyAdminEventControl({
      action: "save",
      title: "STEWARD TITLE",
      remainingMinutes: 8,
    });
    expect(event.title).toBe("STEWARD TITLE");
    expect(event.phase).toBe("live");
    expect(event.remainingMinutes).toBeGreaterThanOrEqual(7);
    expect(event.remainingMinutes).toBeLessThanOrEqual(8);
    expect(currentSimulatedEvent().title).toBe("STEWARD TITLE");
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
});
