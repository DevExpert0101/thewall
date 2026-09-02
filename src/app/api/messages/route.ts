import { jsonError, jsonOk } from "@/lib/http";
import { cacheForPhase, eventSlug, getEventSnapshot } from "@/lib/data/event";
import { loadSealedEdition } from "@/lib/data/editions";
import { listSpectatorPage } from "@/lib/data/load";
import { listMessages, searchPublicMessages } from "@/lib/data/messages";
import { isSimulation } from "@/lib/env";
import { messagesQuerySchema } from "@/lib/validation";
import { publicMessageForPhase } from "@/lib/event/state";
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
      mix: url.searchParams.get("mix") ?? undefined,
    });
    const event = parsed.edition
      ? await loadSealedEdition(parsed.edition)
      : await getEventSnapshot(eventSlug());
    const sort = feedSortForPhase(event.phase, parsed.sort);

    if (parsed.q?.trim()) {
      const found = await searchPublicMessages(event.id, parsed.q);
      return jsonOk(
        { messages: found.map((message) => publicMessageForPhase(message, event.phase)), nextCursor: null },
        { cache: listCache(event.phase) },
      );
    }

    if (parsed.mix === "1" && sort === "rising") {
      const mixed = await listSpectatorPage(event, {
        limit: parsed.limit,
        cursor: parsed.cursor,
      });
      return jsonOk(
        { messages: mixed.messages, nextCursor: mixed.nextCursor, lanes: mixed.lanes },
        { cache: listCache(event.phase) },
      );
    }

    const result = await listMessages({
      eventId: event.id,
      sort,
      limit: parsed.limit,
      cursor: parsed.cursor,
      salt: parsed.salt ?? event.id,
      endsAt: event.endsAt,
    });
    return jsonOk(
      {
        messages: result.messages.map((message) => publicMessageForPhase(message, event.phase)),
        nextCursor: result.nextCursor,
      },
      { cache: listCache(event.phase) },
    );
  } catch (error) {
    return jsonError(error);
  }
}
