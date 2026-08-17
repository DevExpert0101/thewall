import { ARCHIVAL_REMOVAL_TEXT, resolveMessageSort, type AcceptedSort, type MessageSort } from "@/lib/constants";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { isSimulation } from "@/lib/env";
import {
  getSimulatedMessage,
  isSimulationEvent,
  listSimulatedMessages,
  pickSimulatedRandomMessages,
  simulatedMessageList,
} from "@/lib/data/simulation";
import { createServiceSupabase } from "@/lib/supabase/admin";
import type { PublicMessage } from "@/lib/types";
import { parsePublicNumber } from "@/lib/utils";
import {
  SEARCH_MIN_CHARS,
  SEARCH_RESULT_LIMIT,
  WALL_SURFACE_MAX,
  WALL_TRENDING_WINDOW,
} from "@/lib/wall/constants";
import { offsetFromCursor, pageWindow } from "@/lib/wall/feed";
import { compareRising, finalHourStart, selectHiddenGems } from "@/lib/ranking";
import { RANKED_FEED_TTL_MS, remember } from "@/lib/perf/ttl-cache";
import { pickPublicNumbers, RANDOM_PREFETCH } from "@/lib/wall/random";

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
  sort: AcceptedSort | MessageSort;
  limit: number;
  cursor?: string;
  salt?: string;
  endsAt?: string;
  now?: Date;
}): Promise<{ messages: PublicMessage[]; nextCursor: string | null }> {
  const sort = resolveMessageSort(input.sort);
  if (isSimulation() || isSimulationEvent(input.eventId)) {
    return listSimulatedMessages({ ...input, sort, endsAt: input.endsAt, now: input.now });
  }
  const limit = input.limit;

  if (sort === "rising") {
    return listHour(input.eventId, limit, input.cursor);
  }

  if (sort === "gems") {
    return listGems(input.eventId, limit, input.cursor, input.now, input.endsAt);
  }

  if (sort === "random") {
    const picked = await pickRandomMessages({
      eventId: input.eventId,
      count: limit,
    });
    return { messages: picked.messages, nextCursor: null };
  }

  const db = createServiceSupabase();

  if (sort === "final") {
    return listFinalHour(db, input.eventId, limit, input.cursor, input.endsAt);
  }

  if (sort === "new") {
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

async function loadRisingWindow(eventId: string): Promise<PublicMessage[]> {
  const db = createServiceSupabase();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: hourRows, error: rErr } = await db.rpc("hour_reaction_counts", {
    p_event_id: eventId,
    p_since: since,
    p_limit: WALL_TRENDING_WINDOW,
  });

  if (rErr) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Messages could not be loaded.", 503);
  }

  const stats = new Map(
    ((hourRows as { message_id: string; hour_count: number; hour_minutes?: number }[]) ?? []).map(
      (row) => [row.message_id, row],
    ),
  );
  const topIds = [...stats.keys()];

  if (topIds.length === 0) {
    const { data } = await db
      .from("messages")
      .select(PUBLIC_COLUMNS)
      .eq("event_id", eventId)
      .order("published_at", { ascending: false })
      .limit(WALL_TRENDING_WINDOW);
    return ((data as MessageRow[]) ?? []).map(toPublic);
  }

  const { data, error } = await db
    .from("messages")
    .select(PUBLIC_COLUMNS)
    .eq("event_id", eventId)
    .in("id", topIds);

  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Messages could not be loaded.", 503);
  }
  const now = new Date();
  return ((data as MessageRow[]) ?? [])
    .sort((a, b) => {
      const sa = stats.get(a.id);
      const sb = stats.get(b.id);
      return compareRising(
        {
          hourCount: Number(sa?.hour_count ?? 0),
          hourMinutes: Number(sa?.hour_minutes ?? 0),
          reactionCount: a.reaction_count,
          publishedAt: a.published_at,
          publicNumber: a.public_number,
        },
        {
          hourCount: Number(sb?.hour_count ?? 0),
          hourMinutes: Number(sb?.hour_minutes ?? 0),
          reactionCount: b.reaction_count,
          publishedAt: b.published_at,
          publicNumber: b.public_number,
        },
        now,
      );
    })
    .map(toPublic);
}

async function listHour(
  eventId: string,
  limit: number,
  cursor?: string,
): Promise<{ messages: PublicMessage[]; nextCursor: string | null }> {
  const ordered = await remember(`rising:${eventId}`, RANKED_FEED_TTL_MS, () =>
    loadRisingWindow(eventId),
  );
  const windowed = pageWindow(ordered, cursor, limit);
  return { messages: windowed.items, nextCursor: windowed.nextCursor };
}

function gemNow(now: Date | undefined, endsAt?: string): Date {
  const current = now ?? new Date();
  if (endsAt && Date.parse(endsAt) <= current.getTime()) {
    return new Date(endsAt);
  }
  return current;
}

async function loadGemsWindow(eventId: string, now?: Date, endsAt?: string): Promise<PublicMessage[]> {
  const db = createServiceSupabase();
  const { data, error } = await db
    .from("messages")
    .select(PUBLIC_COLUMNS)
    .eq("event_id", eventId)
    .gte("reaction_count", 1)
    .order("reaction_count", { ascending: false })
    .limit(WALL_TRENDING_WINDOW);
  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Messages could not be loaded.", 503);
  }
  return selectHiddenGems(
    ((data as MessageRow[]) ?? []).map((row) => ({
      row,
      reactionCount: row.reaction_count,
      publishedAt: row.published_at,
    })),
    gemNow(now, endsAt),
  ).map((item) => toPublic(item.row));
}

async function listGems(
  eventId: string,
  limit: number,
  cursor?: string,
  now?: Date,
  endsAt?: string,
): Promise<{ messages: PublicMessage[]; nextCursor: string | null }> {
  const gems = await remember(`gems:${eventId}`, RANKED_FEED_TTL_MS, () =>
    loadGemsWindow(eventId, now, endsAt),
  );
  const windowed = pageWindow(gems, cursor, limit);
  return { messages: windowed.items, nextCursor: windowed.nextCursor };
}

async function listFinalHour(
  db: ReturnType<typeof import("@/lib/supabase/admin").createServiceSupabase>,
  eventId: string,
  limit: number,
  cursor?: string,
  endsAt?: string,
): Promise<{ messages: PublicMessage[]; nextCursor: string | null }> {
  if (!endsAt) {
    return { messages: [], nextCursor: null };
  }
  let query = db
    .from("messages")
    .select(PUBLIC_COLUMNS)
    .eq("event_id", eventId)
    .gte("published_at", finalHourStart(endsAt))
    .lte("published_at", endsAt)
    .order("published_at", { ascending: false })
    .order("public_number", { ascending: false });
  const cursorNumber = cursor ? Number.parseInt(cursor, 10) : Number.NaN;
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

export async function pickRandomMessages(input: {
  eventId: string;
  exclude?: number[];
  count?: number;
  random?: () => number;
}): Promise<{ messages: PublicMessage[]; remaining: number; total: number }> {
  const count = Math.min(Math.max(input.count ?? RANDOM_PREFETCH, 1), 8);
  const exclude = input.exclude ?? [];
  if (isSimulation() || isSimulationEvent(input.eventId)) {
    return pickSimulatedRandomMessages({
      eventId: input.eventId,
      exclude,
      count,
      random: input.random,
    });
  }

  const db = createServiceSupabase();
  const { data: counters, error: counterError } = await db
    .from("event_counters")
    .select("total_messages, next_message_number")
    .eq("event_id", input.eventId)
    .maybeSingle();
  if (counterError) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Messages could not be loaded.", 503);
  }
  const maxNumber = Math.max(
    counters?.total_messages ?? 0,
    (counters?.next_message_number ?? 1) - 1,
  );
  if (maxNumber < 1) {
    return { messages: [], remaining: 0, total: 0 };
  }

  const blocked = [...exclude];
  const found: PublicMessage[] = [];
  for (let attempt = 0; attempt < 3 && found.length < count; attempt += 1) {
    const numbers = pickPublicNumbers({
      maxNumber,
      exclude: blocked,
      count: count - found.length,
      random: input.random,
    });
    if (numbers.length === 0) break;
    const { data, error } = await db
      .from("messages")
      .select(PUBLIC_COLUMNS)
      .eq("event_id", input.eventId)
      .in("public_number", numbers);
    if (error) {
      throw new AppError(ERROR_CODES.UNAVAILABLE, "Messages could not be loaded.", 503);
    }
    const rows = ((data as MessageRow[]) ?? []).map(toPublic);
    found.push(...rows);
    blocked.push(...numbers);
  }

  const excluded = new Set(exclude.filter((n) => n >= 1 && n <= maxNumber));
  return {
    messages: found.slice(0, count),
    remaining: Math.max(0, maxNumber - excluded.size - found.length),
    total: maxNumber,
  };
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
  if (needle.length < SEARCH_MIN_CHARS) return [];

  if (isSimulation() || isSimulationEvent(eventId)) {
    const { messages } = await listSimulatedMessages({
      eventId,
      sort: "new",
      limit: 10_000,
    });
    return messages
      .filter((message) => message.text.toLowerCase().includes(needle))
      .slice(0, SEARCH_RESULT_LIMIT);
  }

  const db = createServiceSupabase();
  const escaped = needle.replace(/[%_\\]/g, "");
  if (escaped.length < SEARCH_MIN_CHARS) return [];
  const { data, error } = await db
    .from("public_messages")
    .select(PUBLIC_COLUMNS)
    .eq("event_id", eventId)
    .ilike("text", `%${escaped}%`)
    .order("published_at", { ascending: false })
    .limit(SEARCH_RESULT_LIMIT);
  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Messages could not be loaded.", 503);
  }
  return ((data as MessageRow[]) ?? []).map(toPublic);
}

export async function listLiveSurface(eventId: string): Promise<PublicMessage[]> {
  if (isSimulation() || isSimulationEvent(eventId)) {
    return simulatedMessageList();
  }
  const db = createServiceSupabase();
  const collected: PublicMessage[] = [];
  const page = 500;
  let from = 0;
  while (collected.length < WALL_SURFACE_MAX) {
    const to = Math.min(from + page - 1, WALL_SURFACE_MAX - 1);
    const { data, error } = await db
      .from("messages")
      .select(PUBLIC_COLUMNS)
      .eq("event_id", eventId)
      .order("public_number", { ascending: true })
      .range(from, to);
    if (error) {
      throw new AppError(ERROR_CODES.UNAVAILABLE, "Messages could not be loaded.", 503);
    }
    const rows = (data as MessageRow[]) ?? [];
    collected.push(...rows.map(toPublic));
    if (rows.length < page) break;
    from += page;
  }
  return collected;
}
