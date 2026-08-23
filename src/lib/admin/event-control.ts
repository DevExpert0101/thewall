import "server-only";

import { configPreviewFromEvent } from "@/lib/admin/data";
import type { AdminConfigPreview } from "@/lib/admin/types";
import {
  eventSlug,
  getEventOps,
  getEventSnapshot,
  loadEventSnapshot,
  readEventConfiguration,
} from "@/lib/data/event";
import { assertDangerousConfirm } from "@/lib/admin/confirm";
import {
  closeSimulatedWall,
  configureSimulatedWall,
  currentSimulatedEvent,
  expireSimulatedWall,
  getSimulatedOps,
  startScratchSimulation,
  setSimulatedOps,
  startSimulatedWall,
} from "@/lib/data/simulation";
import { markSimulatedClosed } from "@/lib/data/simulation-session";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { isUnverifiedArchive } from "@/lib/payment/close-policy";
import { assertHistoricalTimestampEdit, clockFieldsWouldChange } from "@/lib/event/admin-edit";
import { isEventClosed, isEventSealed } from "@/lib/event/state";
import { recordAdminOpsAction, type AdminActor } from "@/lib/ops/audit";
import {
  defaultEventOps,
  mergeEventConfiguration,
  opsEqual,
  type EventOpsControls,
} from "@/lib/ops/controls";
import { createServiceSupabase } from "@/lib/supabase/admin";
import type { adminEventSchema } from "@/lib/validation";
import { z } from "zod";

type AdminEventInput = z.infer<typeof adminEventSchema>;

const DEFAULT_DURATION_MINUTES = 24 * 60;
const DEFAULT_ACTOR: AdminActor = { id: "operator", email: "operator" };

function durationMs(input: AdminEventInput) {
  return Math.max(1, input.durationMinutes ?? DEFAULT_DURATION_MINUTES) * 60_000;
}

function nextLiveSlug(editionNumber: number) {
  return `${eventSlug()}-${editionNumber}`;
}

function preview(event: Awaited<ReturnType<typeof getEventSnapshot>>, ops?: EventOpsControls) {
  return configPreviewFromEvent(event, ops ?? defaultEventOps());
}

async function audit(
  eventId: string,
  action: string,
  actor: AdminActor,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  await recordAdminOpsAction({ eventId, action, actor, before, after });
}

function clockInput(input: AdminEventInput) {
  return {
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    remainingMinutes: input.remainingMinutes,
    durationMinutes: input.durationMinutes,
  };
}

/** Start now when the form still holds a previous day's already-finished window. */
function openWindowFromInput(input: AdminEventInput): {
  startsAt?: string;
  endsAt?: string;
  durationMinutes?: number;
} {
  const durationMinutes = input.durationMinutes;
  const startMs = input.startsAt ? Date.parse(input.startsAt) : Number.NaN;
  if (!Number.isFinite(startMs)) {
    return { durationMinutes };
  }
  if (startMs > Date.now()) {
    return { startsAt: input.startsAt, endsAt: input.endsAt, durationMinutes };
  }
  const minutes = Math.max(1, durationMinutes ?? DEFAULT_DURATION_MINUTES);
  if (startMs + minutes * 60_000 <= Date.now()) {
    return { durationMinutes };
  }
  return { startsAt: input.startsAt, endsAt: input.endsAt, durationMinutes };
}

function applyOpsFromInput(current: EventOpsControls, input: AdminEventInput): EventOpsControls {
  return {
    publishEnabled: input.publishEnabled ?? current.publishEnabled,
    reactEnabled: input.reactEnabled ?? current.reactEnabled,
    strictBot: input.strictBot ?? current.strictBot,
  };
}

async function applySimulatedOps(input: AdminEventInput, actor: AdminActor): Promise<AdminConfigPreview> {
  assertDangerousConfirm({
    confirm: input.confirm === true,
    confirmText: input.confirmText ?? "",
    action: "ops",
  });
  const current = getSimulatedOps();
  const next = applyOpsFromInput(current, input);
  if (!opsEqual(current, next)) {
    setSimulatedOps(next);
    await audit(currentSimulatedEvent().id, "ops", actor, { ...current }, { ...next });
  }
  return preview(currentSimulatedEvent(), next);
}

async function applySimulatedEvent(
  input: AdminEventInput,
  actor: AdminActor,
): Promise<AdminConfigPreview> {
  const action = input.action ?? "save";
  if (action === "ops") {
    return applySimulatedOps(input, actor);
  }
  if (action === "reset") {
    const before = preview(currentSimulatedEvent(), getSimulatedOps());
    startScratchSimulation();
    if (input.title || input.durationMinutes) {
      configureSimulatedWall({
        title: input.title,
        durationMinutes: input.durationMinutes,
      });
    }
    await markSimulatedClosed(false);
    const after = currentSimulatedEvent();
    await audit(after.id, "reset", actor, { phase: before.phase, title: before.title }, { phase: after.phase, title: after.title });
    return preview(after, getSimulatedOps());
  }
  if (action === "finish") {
    const current = currentSimulatedEvent();
    if (current.phase === "archived") {
      throw new AppError(ERROR_CODES.EVENT_ENDED, "This Wall is already sealed.", 409);
    }
    if (current.phase === "upcoming") {
      throw new AppError(ERROR_CODES.EVENT_UPCOMING, "This Wall has not opened yet.", 409);
    }
    if (current.phase === "live") {
      expireSimulatedWall();
      const closed = currentSimulatedEvent();
      await audit(closed.id, "close_for_review", actor, { phase: current.phase, endsAt: current.endsAt }, { phase: closed.phase, endsAt: closed.endsAt });
      return preview(closed, getSimulatedOps());
    }
    assertDangerousConfirm({
      confirm: input.confirm === true,
      confirmText: input.confirmText ?? "",
      action: "finish",
    });
    closeSimulatedWall();
    await markSimulatedClosed(true);
    const sealed = currentSimulatedEvent();
    await audit(sealed.id, "finish", actor, { phase: current.phase }, { phase: sealed.phase });
    try {
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/");
      revalidatePath("/monument");
    } catch {
      // Cache hint only.
    }
    return preview(sealed, getSimulatedOps());
  }
  if (action === "start" || action === "openNext") {
    if (currentSimulatedEvent().phase === "finalizing") {
      throw new AppError(
        ERROR_CODES.VALIDATION,
        "Finish this Wall before opening the next day.",
        409,
      );
    }
    const before = currentSimulatedEvent();
    startSimulatedWall({
      title: input.title,
      ...openWindowFromInput(input),
    });
    await markSimulatedClosed(false);
    const after = currentSimulatedEvent();
    await audit(
      after.id,
      action,
      actor,
      { phase: before.phase, startsAt: before.startsAt, endsAt: before.endsAt },
      { phase: after.phase, startsAt: after.startsAt, endsAt: after.endsAt },
    );
    return preview(after, getSimulatedOps());
  }

  const current = currentSimulatedEvent();
  const changingWindow = clockFieldsWouldChange(current, clockInput(input));
  const launched = current.phase !== "upcoming";
  if (
    isEventClosed(current.phase) &&
    (changingWindow || input.title || input.themeQuestion || input.themeDescription || input.themeSlug)
  ) {
    throw new AppError(ERROR_CODES.EVENT_ENDED, "A sealed Wall does not reopen.", 409);
  }
  assertHistoricalTimestampEdit({
    launched,
    changingWindow,
    confirmed: input.confirmHistoricalEdit === true,
    confirmText: input.confirmText,
  });
  configureSimulatedWall({
    title: input.title,
    themeSlug: input.themeSlug,
    themeQuestion: input.themeQuestion,
    themeDescription: input.themeDescription,
    ...(changingWindow
      ? {
          durationMinutes: input.durationMinutes,
          remainingMinutes: input.remainingMinutes,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        }
      : {}),
  });
  const after = currentSimulatedEvent();
  await audit(
    after.id,
    changingWindow ? "clock" : "save",
    actor,
    { title: current.title, startsAt: current.startsAt, endsAt: current.endsAt },
    { title: after.title, startsAt: after.startsAt, endsAt: after.endsAt },
  );
  return preview(after, getSimulatedOps());
}

async function applyLiveOps(
  event: Awaited<ReturnType<typeof getEventSnapshot>>,
  input: AdminEventInput,
  actor: AdminActor,
): Promise<AdminConfigPreview> {
  assertDangerousConfirm({
    confirm: input.confirm === true,
    confirmText: input.confirmText ?? "",
    action: "ops",
  });
  const current = await getEventOps();
  const next = applyOpsFromInput(current, input);
  if (opsEqual(current, next)) {
    return preview(event, current);
  }
  const db = createServiceSupabase();
  const configuration = mergeEventConfiguration(await readEventConfiguration(event.id), next);
  const { error } = await db.from("events").update({ configuration }).eq("id", event.id);
  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Could not update emergency controls.", 503);
  }
  await audit(event.id, "ops", actor, { ...current }, { ...next });
  return preview(await loadEventSnapshot(eventSlug()), next);
}

export async function applyAdminEventControl(
  input: AdminEventInput,
  actor: AdminActor = DEFAULT_ACTOR,
): Promise<AdminConfigPreview> {
  if (isSimulation() || !hasSupabaseConfig()) {
    return applySimulatedEvent(input, actor);
  }

  const event = await getEventSnapshot(eventSlug());
  const action = input.action ?? "save";
  const db = createServiceSupabase();
  const now = new Date();
  const nowIso = now.toISOString();

  if (action === "ops") {
    return applyLiveOps(event, input, actor);
  }

  if (action === "reset") {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "A real Wall is not reset from this console. Seal it, then open the next day.",
      403,
    );
  }

  if (action === "finish") {
    if (isEventSealed(event.phase)) {
      if (isUnverifiedArchive(event)) {
        try {
          const { sealFinalizedEdition } = await import("@/lib/archive/seal");
          await sealFinalizedEdition(event);
        } catch {
          throw new AppError(
            ERROR_CODES.ARCHIVE_SEAL_FAILED,
            "Results are public. The archive is not verified until the seal succeeds.",
            503,
          );
        }
        const sealed = await loadEventSnapshot(eventSlug());
        await audit(event.id, "retry_seal", actor, { archiveHash: event.archiveHash }, { archiveHash: sealed.archiveHash });
        return preview(sealed, await getEventOps());
      }
      throw new AppError(ERROR_CODES.EVENT_ENDED, "This Wall is already sealed.", 409);
    }
    if (event.phase === "upcoming") {
      throw new AppError(ERROR_CODES.EVENT_UPCOMING, "This Wall has not opened yet.", 409);
    }
    if (event.phase === "live") {
      const { error } = await db
        .from("events")
        .update({ ends_at: nowIso })
        .eq("id", event.id);
      if (error) {
        throw new AppError(ERROR_CODES.UNAVAILABLE, "Could not finish this Wall.", 503);
      }
      const closed = await loadEventSnapshot(eventSlug());
      await audit(event.id, "close_for_review", actor, { endsAt: event.endsAt, phase: event.phase }, { endsAt: closed.endsAt, phase: closed.phase });
      return preview(closed, await getEventOps());
    }
    assertDangerousConfirm({
      confirm: input.confirm === true,
      confirmText: input.confirmText ?? "",
      action: "finish",
    });
    await db.rpc("finalize_event_rankings", { p_event_id: event.id });
    const finished = await loadEventSnapshot(eventSlug());
    try {
      const { sealFinalizedEdition } = await import("@/lib/archive/seal");
      await sealFinalizedEdition(finished);
    } catch {
      throw new AppError(
        ERROR_CODES.ARCHIVE_SEAL_FAILED,
        "Results may already be public. The archive is not verified until the seal succeeds.",
        503,
      );
    }
    const sealed = await loadEventSnapshot(eventSlug());
    if (isUnverifiedArchive(sealed)) {
      throw new AppError(
        ERROR_CODES.ARCHIVE_SEAL_FAILED,
        "Results may already be public. The archive is not verified until the seal succeeds.",
        503,
      );
    }
    await audit(event.id, "finish", actor, { phase: event.phase }, { phase: sealed.phase });
    try {
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/");
      revalidatePath("/monument");
    } catch {
      // Cache hint only.
    }
    return preview(sealed, await getEventOps());
  }

  if (action === "openNext") {
    if (!isEventSealed(event.phase)) {
      throw new AppError(
        ERROR_CODES.VALIDATION,
        "Finish this Wall before opening the next day.",
        409,
      );
    }
    const title = input.title?.trim() || event.title;
    const starts = input.startsAt ?? nowIso;
    const ends =
      input.durationMinutes != null
        ? new Date(Date.parse(starts) + durationMs(input)).toISOString()
        : input.endsAt ?? new Date(Date.parse(starts) + durationMs(input)).toISOString();
    if (Date.parse(ends) <= Date.parse(starts)) {
      throw new AppError(ERROR_CODES.VALIDATION, "The close time must be after the open time.", 400);
    }
    const nextEdition = (event.editionNumber ?? 1) + 1;
    const { error } = await db.from("events").insert({
      slug: nextLiveSlug(nextEdition),
      title,
      starts_at: starts,
      ends_at: ends,
    });
    if (error) {
      throw new AppError(ERROR_CODES.UNAVAILABLE, "Could not open the next Wall.", 503);
    }
    const next = await loadEventSnapshot(eventSlug());
    await audit(next.id, "openNext", actor, { edition: event.editionNumber }, { edition: next.editionNumber, startsAt: next.startsAt, endsAt: next.endsAt });
    return preview(next, await getEventOps());
  }

  if (action === "start") {
    if (event.phase === "finalizing") {
      throw new AppError(
        ERROR_CODES.VALIDATION,
        "Finish this Wall before opening the next day.",
        409,
      );
    }
    if (isEventClosed(event.phase)) {
      return applyAdminEventControl({ ...input, action: "openNext" }, actor);
    }
    if (event.phase !== "upcoming") {
      throw new AppError(ERROR_CODES.VALIDATION, "This Wall is already open.", 409);
    }
    const starts = input.startsAt ?? nowIso;
    const ends =
      input.durationMinutes != null
        ? new Date(Date.parse(starts) + durationMs(input)).toISOString()
        : input.endsAt ??
          (Date.parse(event.endsAt) > Date.parse(starts)
            ? event.endsAt
            : new Date(Date.parse(starts) + durationMs(input)).toISOString());
    const { error } = await db
      .from("events")
      .update({
        starts_at: starts,
        ends_at: ends,
        ...(input.title ? { title: input.title } : {}),
      })
      .eq("id", event.id);
    if (error) {
      throw new AppError(ERROR_CODES.UNAVAILABLE, "Could not start this Wall.", 503);
    }
    const started = await loadEventSnapshot(eventSlug());
    await audit(event.id, "start", actor, { phase: event.phase, startsAt: event.startsAt }, { phase: started.phase, startsAt: started.startsAt, endsAt: started.endsAt });
    return preview(started, await getEventOps());
  }

  const changingWindow = clockFieldsWouldChange(event, clockInput(input));
  const launched = Date.parse(event.startsAt) <= Date.now();
  if (
    isEventClosed(event.phase) &&
    (changingWindow || input.title || input.themeQuestion || input.themeDescription || input.themeSlug)
  ) {
    throw new AppError(ERROR_CODES.EVENT_ENDED, "A sealed Wall does not reopen.", 409);
  }
  assertHistoricalTimestampEdit({
    launched,
    changingWindow,
    confirmed: input.confirmHistoricalEdit === true,
    confirmText: input.confirmText,
  });

  const patch: Record<string, string | null> = {};
  if (input.title) patch.title = input.title;
  if (input.themeQuestion !== undefined) {
    const next = input.themeQuestion.trim();
    patch.theme_question = next.length > 0 ? next : null;
  }
  if (input.themeDescription !== undefined) {
    const next = input.themeDescription.trim();
    patch.theme_description = next.length > 0 ? next : null;
  }
  if (input.themeSlug !== undefined) {
    const next = input.themeSlug.trim().toLowerCase();
    patch.theme_slug = next.length > 0 ? next : null;
  }
  const startsAt = changingWindow ? (input.startsAt ?? event.startsAt) : event.startsAt;
  let endsAt = changingWindow ? (input.endsAt ?? event.endsAt) : event.endsAt;
  if (changingWindow && input.durationMinutes) {
    endsAt = new Date(Date.parse(startsAt) + input.durationMinutes * 60_000).toISOString();
  }
  if (changingWindow && input.remainingMinutes) {
    endsAt = new Date(Date.now() + input.remainingMinutes * 60_000).toISOString();
  }
  if (startsAt !== event.startsAt) patch.starts_at = startsAt;
  if (endsAt !== event.endsAt) patch.ends_at = endsAt;
  if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new AppError(ERROR_CODES.VALIDATION, "The close time must be after the open time.", 400);
  }

  if (Object.keys(patch).length === 0) {
    return preview(event, await getEventOps());
  }

  const { error } = await db.from("events").update(patch).eq("id", event.id);
  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Could not update this Wall.", 503);
  }
  const saved = await loadEventSnapshot(eventSlug());
  await audit(
    event.id,
    changingWindow ? "clock" : "save",
    actor,
    { title: event.title, startsAt: event.startsAt, endsAt: event.endsAt },
    { title: saved.title, startsAt: saved.startsAt, endsAt: saved.endsAt },
  );
  return preview(saved, await getEventOps());
}
