import type { MessageSort } from "@/lib/constants";
import type { EventPhase } from "@/lib/event/state";
import { isEventClosed } from "@/lib/event/state";
import type { PublicMessage } from "@/lib/types";
import { WALL_MAX_RENDERED } from "@/lib/wall/constants";

/** After close, time-varying sorts would drift. Lock them to stable Most 🔥. */
export function feedSortForPhase(phase: EventPhase, sort: MessageSort): MessageSort {
  if (isEventClosed(phase) && (sort === "trending" || sort === "hour")) {
    return "hot";
  }
  return sort;
}

export function offsetFromCursor(cursor?: string): number {
  if (!cursor) return 0;
  const n = Number.parseInt(cursor, 10);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

export function pageWindow<T>(
  items: T[],
  cursor: string | undefined,
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const offset = offsetFromCursor(cursor);
  const slice = items.slice(offset, offset + limit);
  const next = offset + limit < items.length ? String(offset + limit) : null;
  return { items: slice, nextCursor: next };
}

export function capFeed(
  messages: PublicMessage[],
  max = WALL_MAX_RENDERED,
): PublicMessage[] {
  return messages.length <= max ? messages : messages.slice(0, max);
}

export function mergeArrival(
  current: PublicMessage[],
  incoming: PublicMessage,
): PublicMessage[] {
  if (
    current.some(
      (message) => message.id === incoming.id || message.publicNumber === incoming.publicNumber,
    )
  ) {
    return current;
  }
  return capFeed([incoming, ...current]);
}

export function applyReactionCounts(
  messages: PublicMessage[],
  counts: Record<string, number>,
): PublicMessage[] {
  let changed = false;
  const next = messages.map((message) => {
    const count = counts[message.id];
    if (typeof count !== "number" || count <= message.reactionCount) return message;
    changed = true;
    return { ...message, reactionCount: count };
  });
  return changed ? next : messages;
}

export function applyOptimisticReaction(
  messages: PublicMessage[],
  messageId: string,
  count: number,
): PublicMessage[] {
  return messages.map((message) =>
    message.id === messageId
      ? { ...message, reactionCount: Math.max(message.reactionCount, count) }
      : message,
  );
}

/** Variable-height masonry stays under WALL_MAX_RENDERED; windowing would fight CSS columns. */
export function shouldVirtualize(renderedCount: number): boolean {
  return renderedCount > WALL_MAX_RENDERED;
}

export function arrivalFromRealtime(row: {
  id: string;
  event_id: string;
  public_number: number;
  text: string;
  reaction_count: number;
  published_at: string;
}): PublicMessage {
  return {
    id: row.id,
    eventId: row.event_id,
    publicNumber: row.public_number,
    text: row.text,
    isRemoved: false,
    reactionCount: row.reaction_count,
    publishedAt: row.published_at,
    finalRank: null,
  };
}
