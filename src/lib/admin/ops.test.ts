import { afterEach, describe, expect, it } from "vitest";
import { loadAdminOps } from "@/lib/admin/ops";
import { applyAdminEventControl } from "@/lib/admin/event-control";
import { listAdminOpsAudit } from "@/lib/ops/audit";
import { configureSimulatedWall, currentSimulatedEvent, resetSimulationState } from "@/lib/data/simulation";
import { payloadContainsSecret } from "@/lib/admin/sanitize";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { assertPublishOpen, assertReactOpen } from "@/lib/event/state";

describe("launch-day ops", () => {
  afterEach(() => {
    resetSimulationState();
  });

  it("reports real simulation counts and never invents viewers", async () => {
    const event = currentSimulatedEvent();
    const ops = await loadAdminOps(event);
    expect(ops.event.state).toBe(event.phase);
    expect(ops.event.startsAt).toBe(event.startsAt);
    expect(ops.event.endsAt).toBe(event.endsAt);
    expect(ops.messages.total).toBe(event.totalMessages);
    expect(ops.reactions.total).toBe(event.totalReactions);
    expect(ops.traffic.activeViewers).toBeNull();
    expect(ops.traffic.errorRate).toBeNull();
    expect(ops.traffic.note).toMatch(/not counted|never invented/i);
    expect(ops.moderation.removals).toBeGreaterThanOrEqual(1);
    expect(payloadContainsSecret(ops)).toBe(false);
  });

  it("pauses publish or reactions without moving the deadline", async () => {
    configureSimulatedWall({
      startsAt: "2026-08-16T00:00:00.000Z",
      endsAt: "2026-08-17T00:00:00.000Z",
    });
    const before = currentSimulatedEvent();
    await expect(
      applyAdminEventControl({
        action: "ops",
        publishEnabled: false,
        confirm: true,
        confirmText: "OPS",
      }),
    ).resolves.toMatchObject({ publishEnabled: false, endsAt: before.endsAt, startsAt: before.startsAt });

    const paused = await loadAdminOps();
    expect(paused.controls.publishEnabled).toBe(false);
    expect(paused.event.endsAt).toBe(before.endsAt);
    expect(() =>
      assertPublishOpen({ phase: "live", endsAt: before.endsAt }, paused.controls),
    ).toThrow(AppError);
    expect(() =>
      assertReactOpen({ phase: "live", endsAt: before.endsAt }, paused.controls),
    ).not.toThrow();

    await applyAdminEventControl({
      action: "ops",
      reactEnabled: false,
      confirm: true,
      confirmText: "OPS",
    });
    const both = (await loadAdminOps()).controls;
    expect(() => assertReactOpen({ phase: "live", endsAt: before.endsAt }, both)).toThrow(AppError);
    expect(currentSimulatedEvent().endsAt).toBe(before.endsAt);
  });

  it("refuses emergency changes without OPS and audits successful ones", async () => {
    await expect(
      applyAdminEventControl({ action: "ops", strictBot: true, confirm: true, confirmText: "yes" }),
    ).rejects.toMatchObject({ code: ERROR_CODES.CONFIRMATION_REQUIRED });
    expect((await loadAdminOps()).controls.strictBot).toBe(false);

    await applyAdminEventControl({
      action: "ops",
      strictBot: true,
      confirm: true,
      confirmText: "OPS",
    });
    const audit = await listAdminOpsAudit();
    expect(audit.some((row) => row.action === "ops")).toBe(true);
    expect(audit[0]?.after).toMatchObject({ strictBot: true });
    expect(payloadContainsSecret(audit)).toBe(false);
  });
});
