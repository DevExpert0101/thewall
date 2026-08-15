import { jsonError, jsonOk } from "@/lib/http";
import { cacheForPhase, eventSlug, getEventSnapshot } from "@/lib/data/event";
import { loadSealedEdition } from "@/lib/data/editions";
import { listMessages, searchPublicMessages } from "@/lib/data/messages";
import { isSimulation } from "@/lib/env";
import { messagesQuerySchema } from "@/lib/validation";
import { feedSortForPhase } from "@/lib/wall/feed";
import type { EventSnapshot } from "@/lib/types";

function listCache(phase: EventSnapshot["phase"]): string {
  return isSimulation() ? "private, no-store" : cacheForPhase(phase);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = messagesQuerySchema.parse({
      sort: url.searchParams.get("sort") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      salt: url.searchParams.get("salt") ?? undefined,
      edition: url.searchParams.get("edition") ?? undefined,
    });
    const event = parsed.edition
      ? await loadSealedEdition(parsed.edition)
      : await getEventSnapshot(eventSlug());
    const sort = feedSortForPhase(event.phase, parsed.sort);

    if (parsed.q?.trim()) {
      const found = await searchPublicMessages(event.id, parsed.q);
      return jsonOk({ messages: found, nextCursor: null }, { cache: listCache(event.phase) });
    }

    const result = await listMessages({
      eventId: event.id,
      sort,
      limit: parsed.limit,
      cursor: parsed.cursor,
      salt: parsed.salt,
    });
    return jsonOk(result, { cache: listCache(event.phase) });
  } catch (error) {
    return jsonError(error);
  }
}
