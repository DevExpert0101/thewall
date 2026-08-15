import "server-only";

import { configPreviewFromEvent } from "@/lib/admin/data";
import type { AdminConfigPreview } from "@/lib/admin/types";
import { eventSlug, getEventSnapshot, loadEventSnapshot } from "@/lib/data/event";
import {
  closeSimulatedWall,
  configureSimulatedWall,
  currentSimulatedEvent,
  resetLiveSimulation,
  startSimulatedWall,
} from "@/lib/data/simulation";
import { markSimulatedClosed } from "@/lib/data/simulation-session";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { assertHistoricalTimestampEdit } from "@/lib/event/admin-edit";
import { isEventClosed } from "@/lib/event/state";
import { createServiceSupabase } from "@/lib/supabase/admin";
import type { adminEventSchema } from "@/lib/validation";
import { z } from "zod";

type AdminEventInput = z.infer<typeof adminEventSchema>;

const DEFAULT_DURATION_MINUTES = 24 * 60;

function durationMs(input: AdminEventInput) {
  return Math.max(1, input.durationMinutes ?? DEFAULT_DURATION_MINUTES) * 60_000;
}

function nextLiveSlug(editionNumber: number) {
  return `${eventSlug()}-${editionNumber}`;
}

async function applySimulatedEvent(input: AdminEventInput): Promise<AdminConfigPreview> {
  const action = input.action ?? "save";
  if (action === "reset") {
    resetLiveSimulation();
    if (input.title || input.durationMinutes) {
      configureSimulatedWall({
        title: input.title,
        durationMinutes: input.durationMinutes,
      });
    }
    await markSimulatedClosed(false);
    return configPreviewFromEvent(currentSimulatedEvent());
  }
  if (action === "finish") {
    closeSimulatedWall();
    await markSimulatedClosed(true);
    return configPreviewFromEvent(currentSimulatedEvent());
  }
  if (action === "start" || action === "openNext") {
    startSimulatedWall({
      title: input.title,
      durationMinutes: input.durationMinutes,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
    await markSimulatedClosed(false);
    return configPreviewFromEvent(currentSimulatedEvent());
  }
  configureSimulatedWall({
    title: input.title,
    durationMinutes: input.durationMinutes,
    remainingMinutes: input.remainingMinutes,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  });
  return configPreviewFromEvent(currentSimulatedEvent());
}

export async function applyAdminEventControl(input: AdminEventInput): Promise<AdminConfigPreview> {
  if (isSimulation() || !hasSupabaseConfig()) {
    return applySimulatedEvent(input);
  }

  const event = await getEventSnapshot(eventSlug());
  const action = input.action ?? "save";
  const db = createServiceSupabase();
  const now = new Date();
  const nowIso = now.toISOString();

  if (action === "reset") {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "A real Wall is not reset from this console. Seal it, then open the next day.",
      403,
    );
  }

  if (action === "finish") {
    if (isEventClosed(event.phase)) {
      throw new AppError(ERROR_CODES.EVENT_ENDED, "This Wall is already sealed.", 409);
    }
    if (event.phase === "upcoming") {
      throw new AppError(ERROR_CODES.EVENT_UPCOMING, "This Wall has not opened yet.", 409);
    }
    const { error } = await db
      .from("events")
      .update({ ends_at: nowIso })
      .eq("id", event.id);
    if (error) {
      throw new AppError(ERROR_CODES.UNAVAILABLE, "Could not finish this Wall.", 503);
    }
    await db.rpc("finalize_event_rankings", { p_event_id: event.id });
    return configPreviewFromEvent(await loadEventSnapshot(eventSlug()));
  }

  if (action === "openNext") {
    if (!isEventClosed(event.phase) && event.phase !== "finalizing") {
      throw new AppError(
        ERROR_CODES.VALIDATION,
        "Finish this Wall before opening the next day.",
        409,
      );
    }
    const title = input.title?.trim() || event.title;
    const starts = input.startsAt ?? nowIso;
    const ends = input.endsAt ?? new Date(Date.parse(starts) + durationMs(input)).toISOString();
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
    return configPreviewFromEvent(await loadEventSnapshot(eventSlug()));
  }

  if (action === "start") {
    if (isEventClosed(event.phase)) {
      return applyAdminEventControl({ ...input, action: "openNext" });
    }
    if (event.phase !== "upcoming") {
      throw new AppError(ERROR_CODES.VALIDATION, "This Wall is already open.", 409);
    }
    const starts = input.startsAt ?? nowIso;
    const ends =
      input.endsAt ??
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
    return configPreviewFromEvent(await loadEventSnapshot(eventSlug()));
  }

  const changingWindow = Boolean(input.startsAt || input.endsAt || input.remainingMinutes || input.durationMinutes);
  const launched = Date.parse(event.startsAt) <= Date.now();
  if (isEventClosed(event.phase) && (changingWindow || input.title)) {
    throw new AppError(ERROR_CODES.EVENT_ENDED, "A sealed edition does not reopen.", 409);
  }
  assertHistoricalTimestampEdit({
    launched,
    changingWindow,
    confirmed: input.confirmHistoricalEdit === true,
  });

  const patch: Record<string, string> = {};
  if (input.title) patch.title = input.title;
  let startsAt = input.startsAt ?? event.startsAt;
  let endsAt = input.endsAt ?? event.endsAt;
  if (input.durationMinutes) {
    endsAt = new Date(Date.parse(startsAt) + input.durationMinutes * 60_000).toISOString();
  }
  if (input.remainingMinutes) {
    endsAt = new Date(Date.now() + input.remainingMinutes * 60_000).toISOString();
  }
  if (startsAt !== event.startsAt) patch.starts_at = startsAt;
  if (endsAt !== event.endsAt) patch.ends_at = endsAt;
  if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new AppError(ERROR_CODES.VALIDATION, "The close time must be after the open time.", 400);
  }

  if (Object.keys(patch).length === 0) {
    return configPreviewFromEvent(event);
  }

  const { error } = await db.from("events").update(patch).eq("id", event.id);
  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Could not update this Wall.", 503);
  }
  return configPreviewFromEvent(await loadEventSnapshot(eventSlug()));
}
