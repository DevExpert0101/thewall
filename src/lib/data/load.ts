import { connection } from "next/server";
import { eventSlug, getEventSnapshot } from "@/lib/data/event";
import { listSealedEditions } from "@/lib/data/editions";
import { syncSimulatedCloseFromCookie } from "@/lib/data/simulation-session";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { EditionSummary, EventSnapshot, PublicMessage } from "@/lib/types";
import { listMessages } from "@/lib/data/messages";

export async function loadEvent(): Promise<EventSnapshot> {
  if (isSimulation()) {
    try {
      await connection();
      await syncSimulatedCloseFromCookie();
    } catch {
      // request cookies / connection() are unavailable in some workers and tests
    }
  }
  try {
    return await getEventSnapshot(eventSlug());
  } catch (error) {
    const incomplete =
      isSimulation() ||
      !hasSupabaseConfig() ||
      (error instanceof AppError && error.code === ERROR_CODES.CONFIG);
    if (incomplete) {
      const { currentSimulatedEvent } = await import("@/lib/data/simulation");
      return currentSimulatedEvent();
    }
    throw error;
  }
}

export async function loadArchiveEditions(): Promise<EditionSummary[]> {
  if (isSimulation()) {
    try {
      await connection();
      await syncSimulatedCloseFromCookie();
    } catch {
      // request cookies / connection() are unavailable in some workers and tests
    }
  }
  return listSealedEditions();
}

export async function loadPreview(event: EventSnapshot): Promise<PublicMessage[]> {
  try {
    const { messages } = await listMessages({
      eventId: event.id,
      sort: "trending",
      limit: 12,
    });
    return messages;
  } catch {
    return [];
  }
}
