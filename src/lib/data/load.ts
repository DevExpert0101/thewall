import { connection } from "next/server";
import { eventSlug, getEventSnapshot } from "@/lib/data/event";
import { isSimulation } from "@/lib/env";
import type { EventSnapshot, PublicMessage } from "@/lib/types";
import { listMessages } from "@/lib/data/messages";

export async function loadEvent(): Promise<EventSnapshot> {
  if (isSimulation()) {
    await connection();
  }
  try {
    return await getEventSnapshot(eventSlug());
  } catch (error) {
    if (isSimulation()) {
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
      limit: 6,
    });
    return messages;
  } catch {
    return [];
  }
}
