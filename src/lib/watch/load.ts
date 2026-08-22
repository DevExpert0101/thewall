import { listSpectatorPage } from "@/lib/data/load";
import { listMessages, pickRandomMessages } from "@/lib/data/messages";
import { publicMessageForPhase } from "@/lib/event/state";
import { feedSortForPhase } from "@/lib/wall/feed";
import type { EventSnapshot, PublicMessage } from "@/lib/types";
import { WATCH_MODE_META, type WatchMode } from "@/lib/watch/config";

export async function loadWatchMessages(
  event: EventSnapshot,
  mode: WatchMode,
): Promise<PublicMessage[]> {
  const meta = WATCH_MODE_META[mode];
  try {
    if (mode === "random") {
      const picked = await pickRandomMessages({ eventId: event.id, count: 2 });
      return picked.messages.map((message) => publicMessageForPhase(message, event.phase));
    }
    if (mode === "rising" && event.phase === "live") {
      const mixed = await listSpectatorPage(event, { limit: meta.limit });
      return mixed.messages;
    }
    const listed = await listMessages({
      eventId: event.id,
      sort: feedSortForPhase(event.phase, meta.sort),
      limit: meta.limit,
      endsAt: event.endsAt,
    });
    return listed.messages.map((message) => publicMessageForPhase(message, event.phase));
  } catch {
    return [];
  }
}
