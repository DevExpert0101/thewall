import { jsonError, jsonOk } from "@/lib/http";
import { PULSE_CACHE_CONTROL, eventSlug, getEventSnapshot } from "@/lib/data/event";
import { getReactionCounts } from "@/lib/data/messages";
import { deriveEventPhase } from "@/lib/event/state";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { pulseQuerySchema } from "@/lib/validation";

type PulseRow = {
  starts_at: string;
  ends_at: string;
  archived_at: string | null;
  finalized_at: string | null;
  total_messages: number;
  total_reactions: number;
  counts: Record<string, number>;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = pulseQuerySchema.parse({
      ids: url.searchParams.get("ids") ?? "",
      eventId: url.searchParams.get("eventId") ?? undefined,
    });

    if (isSimulation() || !hasSupabaseConfig()) {
      const event = await getEventSnapshot(eventSlug());
      const counts = await getReactionCounts(event.id, parsed.ids);
      return jsonOk(
        {
          counts,
          totalMessages: event.totalMessages,
          totalReactions: event.totalReactions,
          phase: event.phase,
          serverNow: event.serverNow,
        },
        { cache: PULSE_CACHE_CONTROL },
      );
    }

    const db = createServiceSupabase();
    const eventId = parsed.eventId;
    if (!eventId) {
      const event = await getEventSnapshot(eventSlug());
      const counts = await getReactionCounts(event.id, parsed.ids);
      return jsonOk(
        {
          counts,
          totalMessages: event.totalMessages,
          totalReactions: event.totalReactions,
          phase: event.phase,
          serverNow: event.serverNow,
        },
        { cache: PULSE_CACHE_CONTROL },
      );
    }

    const { data, error } = await db.rpc("wall_pulse", {
      p_event_id: eventId,
      p_ids: parsed.ids,
    });
    if (error || !data) {
      const event = await getEventSnapshot(eventSlug());
      const counts = await getReactionCounts(event.id, parsed.ids);
      return jsonOk(
        {
          counts,
          totalMessages: event.totalMessages,
          totalReactions: event.totalReactions,
          phase: event.phase,
          serverNow: event.serverNow,
        },
        { cache: PULSE_CACHE_CONTROL },
      );
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
        phase,
        serverNow: new Date().toISOString(),
      },
      { cache: PULSE_CACHE_CONTROL },
    );
  } catch (error) {
    return jsonError(error);
  }
}