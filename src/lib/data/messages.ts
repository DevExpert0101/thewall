import { ARCHIVAL_REMOVAL_TEXT, type MessageSort } from "@/lib/constants";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { isSimulation } from "@/lib/env";
import {
  getSimulatedMessage,
  isSimulationEvent,
  listSimulatedMessages,
  simulatedMessageList,
} from "@/lib/data/simulation";
import { createServiceSupabase } from "@/lib/supabase/admin";
import type { PublicMessage } from "@/lib/types";
import { parsePublicNumber } from "@/lib/utils";
import { WALL_TRENDING_WINDOW } from "@/lib/wall/constants";
import { offsetFromCursor, pageWindow } from "@/lib/wall/feed";
import { trendingScore } from "@/lib/ranking";

type MessageRow = {
  id: string;
  event_id: string;
  public_number: number;
  text: string;
  reaction_count: number;
  published_at: string;
  final_rank: number | null;
  removed_at: string | null;
};

function toPublic(row: MessageRow): PublicMessage {
  const removed = Boolean(row.removed_at);
  return {
    id: row.id,
    eventId: row.event_id,
    publicNumber: row.public_number,
    text: removed ? ARCHIVAL_REMOVAL_TEXT : row.text,
    isRemoved: removed,
    reactionCount: row.reaction_count,
    publishedAt: row.published_at,
    finalRank: row.final_rank,
  };
}

const PUBLIC_COLUMNS =
  "id, event_id, public_number, text, reaction_count, published_at, final_rank, removed_at";

export async function getMessageByNumber(
  eventId: string,
  publicNumber: number,
): Promise<PublicMessage> {
  if (isSimulation() || isSimulationEvent(eventId)) {
    return getSimulatedMessage(publicNumber, eventId);
  }
  const db = createServiceSupabase();
  const { data, error } = await db
    .from("messages")
    .select(PUBLIC_COLUMNS)
    .eq("event_id", eventId)
    .eq("public_number", publicNumber)
    .maybeSingle();

  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Message could not be loaded.", 503);
  }
  if (!data) {
    throw new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, "Message not found.", 404);
  }
  return toPublic(data as MessageRow);
}

export async function listMessages(input: {
  eventId: string;
  sort: MessageSort;
  limit: number;
  cursor?: string;
  salt?: string;
}): Promise<{ messages: PublicMessage[]; nextCursor: string | null }> {
  if (isSimulation() || isSimulationEvent(input.eventId)) {
    return listSimulatedMessages(input);
  }
  const db = createServiceSupabase();
  const limit = input.limit;

  if (input.sort === "hour") {
    return listHour(db, input.eventId, limit, input.cursor);
  }

  if (input.sort === "random") {
    const salt = input.salt ?? crypto.randomUUID();
    const { data, error } = await db
      .from("messages")
      .select(PUBLIC_COLUMNS)
      .eq("event_id", input.eventId)
      .order("published_at", { ascending: false })
      .limit(WALL_TRENDING_WINDOW);
    if (error) {
      throw new AppError(ERROR_CODES.UNAVAILABLE, "Messages could not be loaded.", 503);
    }
    const shuffled = [...((data as MessageRow[]) ?? [])].sort((a, b) => {
      const ha = hashSort(a.id, salt);
      const hb = hashSort(b.id, salt);
      return ha.localeCompare(hb);
    });
    const windowed = pageWindow(shuffled, input.cursor, limit);
    return {
      messages: windowed.items.map(toPublic),
      nextCursor: windowed.nextCursor,
    };
  }

  if (input.sort === "trending") {
    const { data, error } = await db
      .from("messages")
      .select(PUBLIC_COLUMNS)
      .eq("event_id", input.eventId)
      .order("reaction_count", { ascending: false })
      .limit(WALL_TRENDING_WINDOW);
    if (error) {
      throw new AppError(ERROR_CODES.UNAVAILABLE, "Messages could not be loaded.", 503);
    }
    const now = new Date();
    const scored = ((data as MessageRow[]) ?? [])
      .map((row) => ({
        row,
        score: trendingScore(row.reaction_count, new Date(row.published_at), now),
      }))
      .sort((a, b) => b.score - a.score || b.row.published_at.localeCompare(a.row.published_at));
    const windowed = pageWindow(scored, input.cursor, limit);
    return {
      messages: windowed.items.map((s) => toPublic(s.row)),
      nextCursor: windowed.nextCursor,
    };
  }

  if (input.sort === "new") {
    let query = db
      .from("messages")
      .select(PUBLIC_COLUMNS)
      .eq("event_id", input.eventId)
      .order("published_at", { ascending: false })
      .order("public_number", { ascending: false });
    const cursorNumber = input.cursor ? Number.parseInt(input.cursor, 10) : Number.NaN;
    if (Number.isInteger(cursorNumber) && cursorNumber > 0) {
      query = query.lt("public_number", cursorNumber);
    }
    const { data, error } = await query.limit(limit + 1);
    if (error) {
      throw new AppError(ERROR_CODES.UNAVAILABLE, "Messages could not be loaded.", 503);
    }
    const rows = (data as MessageRow[]) ?? [];
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      messages: page.map(toPublic),
      nextCursor: hasMore ? String(page[page.length - 1]?.public_number ?? "") : null,
    };
  }

  const offset = offsetFromCursor(input.cursor);
  const { data, error } = await db
    .from("messages")
    .select(PUBLIC_COLUMNS)
    .eq("event_id", input.eventId)
    .order("reaction_count", { ascending: false })
    .order("published_at", { ascending: true })
    .order("public_number", { ascending: true })
    .range(offset, offset + limit);
  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Messages could not be loaded.", 503);
  }
  const rows = (data as MessageRow[]) ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    messages: page.map(toPublic),
    nextCursor: hasMore ? String(offset + page.length) : null,
  };
}

async function listHour(
  db: ReturnType<typeof import("@/lib/supabase/admin").createServiceSupabase>,
  eventId: string,
  limit: number,
  cursor?: string,
): Promise<{ messages: PublicMessage[]; nextCursor: string | null }> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: hourRows, error: rErr } = await db.rpc("hour_reaction_counts", {
    p_event_id: eventId,
    p_since: since,
    p_limit: WALL_TRENDING_WINDOW,
  });

  if (rErr) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Messages could not be loaded.", 503);
  }

  const topIds = ((hourRows as { message_id: string; hour_count: number }[]) ?? []).map(
    (row) => row.message_id,
  );

  if (topIds.length === 0) {
    const { data } = await db
      .from("messages")
      .select(PUBLIC_COLUMNS)
      .eq("event_id", eventId)
      .order("published_at", { ascending: false })
      .limit(WALL_TRENDING_WINDOW);
    const windowed = pageWindow((data as MessageRow[]) ?? [], cursor, limit);
    return { messages: windowed.items.map(toPublic), nextCursor: windowed.nextCursor };
  }

  const { data, error } = await db
    .from("messages")
    .select(PUBLIC_COLUMNS)
    .eq("event_id", eventId)
    .in("id", topIds);

  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Messages could not be loaded.", 503);
  }
  const byId = new Map(((data as MessageRow[]) ?? []).map((m) => [m.id, m]));
  const ordered = topIds.map((id) => byId.get(id)).filter(Boolean) as MessageRow[];
  const windowed = pageWindow(ordered, cursor, limit);
  return { messages: windowed.items.map(toPublic), nextCursor: windowed.nextCursor };
}

function hashSort(id: string, salt: string): string {
  let h = 0;
  const s = id + salt;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export async function getReactionCounts(
  eventId: string,
  ids: string[],
): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  if (isSimulation() || isSimulationEvent(eventId)) {
    const counts: Record<string, number> = {};
    for (const message of simulatedMessageList()) {
      if (ids.includes(message.id)) counts[message.id] = message.reactionCount;
    }
    return counts;
  }
  const db = createServiceSupabase();
  const { data, error } = await db
    .from("messages")
    .select("id, reaction_count")
    .eq("event_id", eventId)
    .in("id", ids);
  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Counts could not be loaded.", 503);
  }
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.id as string] = row.reaction_count as number;
  }
  return counts;
}

export async function searchByPublicNumber(
  eventId: string,
  n: number,
): Promise<PublicMessage | null> {
  try {
    return await getMessageByNumber(eventId, n);
  } catch (error) {
    if (error instanceof AppError && error.code === ERROR_CODES.MESSAGE_NOT_FOUND) {
      return null;
    }
    throw error;
  }
}

export function normalizeSearchNeedle(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 140);
}

export async function searchPublicMessages(
  eventId: string,
  q: string,
): Promise<PublicMessage[]> {
  const n = parsePublicNumber(q);
  if (n) {
    const found = await searchByPublicNumber(eventId, n);
    return found ? [found] : [];
  }

  const needle = normalizeSearchNeedle(q);
  if (needle.length < 2) return [];

  if (isSimulation() || isSimulationEvent(eventId)) {
    const { messages } = await listSimulatedMessages({
      eventId,
      sort: "new",
      limit: 10_000,
    });
    return messages.filter((message) => message.text.toLowerCase().includes(needle)).slice(0, 50);
  }

  const db = createServiceSupabase();
  const escaped = needle.replace(/[%_\\]/g, "");
  if (escaped.length < 2) return [];
  const { data, error } = await db
    .from("public_messages")
    .select(PUBLIC_COLUMNS)
    .eq("event_id", eventId)
    .ilike("text", `%${escaped}%`)
    .order("published_at", { ascending: false })
    .limit(50);
  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Messages could not be loaded.", 503);
  }
  return ((data as MessageRow[]) ?? []).map(toPublic);
}
