import { connection } from "next/server";
import { eventSlug, getEventSnapshot } from "@/lib/data/event";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { EventSnapshot, PublicMessage } from "@/lib/types";
import { listMessages } from "@/lib/data/messages";

export async function loadEvent(): Promise<EventSnapshot> {
  if (isSimulation()) {
    await connection();
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
