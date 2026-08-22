import { jsonError, jsonOk } from "@/lib/http";
import { eventSlug, getEventSnapshot, pulseCacheControl } from "@/lib/data/event";
import { getReactionCounts } from "@/lib/data/messages";
import { deriveEventPhase } from "@/lib/event/state";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { pulseQuerySchema } from "@/lib/validation";
import type { EventSnapshot } from "@/lib/types";

type PulseRow = {
  starts_at: string;
  ends_at: string;
  archived_at: string | null;
  finalized_at: string | null;
  total_messages: number;
  total_reactions: number;
  latest_public_number?: number;
  counts: Record<string, number>;
};

function fromSnapshot(
  event: EventSnapshot,
  counts: Record<string, number>,
  latestPublicNumber?: number,
) {
  return {
    counts,
    totalMessages: event.totalMessages,
    totalReactions: event.totalReactions,
    latestPublicNumber: latestPublicNumber ?? event.totalMessages,
    phase: event.phase,
    serverNow: event.serverNow,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    editionNumber: event.editionNumber,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = pulseQuerySchema.parse({
      ids: url.searchParams.get("ids") ?? "",
      eventId: url.searchParams.get("eventId") ?? undefined,
    });
    const hasIds = parsed.ids.length > 0;
    const cache = isSimulation() ? "private, no-store" : pulseCacheControl(hasIds);

    if (isSimulation() || !hasSupabaseConfig()) {
      const event = await getEventSnapshot(eventSlug());
      const counts = hasIds ? await getReactionCounts(event.id, parsed.ids) : {};
      return jsonOk(fromSnapshot(event, counts), { cache });
    }

    const eventId = parsed.eventId;
    if (!eventId) {
      const event = await getEventSnapshot(eventSlug());
      const counts = hasIds ? await getReactionCounts(event.id, parsed.ids) : {};
      return jsonOk(fromSnapshot(event, counts), { cache });
    }

    const db = createServiceSupabase();
    const { data, error } = await db.rpc("wall_pulse", {
      p_event_id: eventId,
      p_ids: parsed.ids,
    });
    if (error || !data) {
      const event = await getEventSnapshot(eventSlug());
      const counts = hasIds ? await getReactionCounts(event.id, parsed.ids) : {};
      return jsonOk(fromSnapshot(event, counts), { cache });
    }

    const row = data as PulseRow;
    const phase = deriveEventPhase({
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      archivedAt: row.archived_at,
      finalizedAt: row.finalized_at,
    });
    return jsonOk(
      {
        counts: row.counts ?? {},
        totalMessages: row.total_messages,
        totalReactions: row.total_reactions,
        latestPublicNumber: row.latest_public_number ?? row.total_messages,
        phase,
        serverNow: new Date().toISOString(),
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      },
      { cache },
    );
  } catch (error) {
    return jsonError(error);
  }
}
