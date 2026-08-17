import { buildCanonicalArchive } from "@/lib/archive/canonical";
import {
  allTimeFromEditions,
  highlightFrom,
  recordsFromMessages,
  type ReactionStamp,
} from "@/lib/archive/records";
import { getEventByEdition, getEventSnapshot } from "@/lib/data/event";
import { listMessages } from "@/lib/data/messages";
import {
  getSimulatedEdition,
  getSimulatedMessage,
  isSimulatedWallClosed,
  listSimulatedEditions,
  listSimulatedMessages,
} from "@/lib/data/simulation";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { remember } from "@/lib/perf/ttl-cache";
import { createServiceSupabase } from "@/lib/supabase/admin";
import type {
  AllTimeRecords,
  EditionHighlight,
  EditionRecords,
  EditionSummary,
  EventSnapshot,
  PublicMessage,
} from "@/lib/types";
import { deriveEventPhase } from "@/lib/event/state";
import { editionNumberOf } from "@/lib/utils";

const PAGE = 50;

function toHighlight(row: {
  public_number: number;
  text: string;
  is_removed?: boolean;
  reaction_count: number;
  final_rank: number | null;
  published_at: string;
} | null): EditionHighlight | null {
  if (!row) return null;
  return {
    publicNumber: row.public_number,
    text: row.text,
    isRemoved: Boolean(row.is_removed),
    reactionCount: row.reaction_count,
    finalRank: row.final_rank,
    publishedAt: row.published_at,
  };
}

async function allPublicMessages(eventId: string): Promise<PublicMessage[]> {
  const messages: PublicMessage[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 400; i += 1) {
    const page = await listMessages({
      eventId,
      sort: "new",
      limit: PAGE,
      cursor,
    });
    messages.push(...page.messages);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return messages;
}

export async function listSealedEditions(): Promise<EditionSummary[]> {
  if (isSimulation() || !hasSupabaseConfig()) {
    return listSimulatedEditions();
  }
  return remember("sealed-editions", 60_000, loadSealedEditionsFromDb);
}

async function loadSealedEditionsFromDb(): Promise<EditionSummary[]> {
  const db = createServiceSupabase();
  const { data: events, error } = await db
    .from("events")
    .select(
      "id, slug, title, starts_at, ends_at, archived_at, finalized_at, edition_number, theme_question, archive_hash, merkle_root, archive_uri, proof_tx",
    )
    .or("finalized_at.not.is.null,archived_at.not.is.null")
    .order("edition_number", { ascending: true });

  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Archive could not be loaded.", 503);
  }

  const sealed = (events ?? []).filter((row) => {
    const phase = deriveEventPhase({
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      archivedAt: row.archived_at,
      finalizedAt: row.finalized_at,
    });
    return phase === "archived";
  });
  if (sealed.length === 0) return [];

  const ids = sealed.map((row) => row.id);
  const { data: counters } = await db
    .from("event_counters")
    .select("event_id, total_messages, total_reactions")
    .in("event_id", ids);
  const counterById = new Map(
    (counters ?? []).map((row) => [row.event_id as string, row]),
  );

  const { data: winners } = await db
    .from("public_messages")
    .select("event_id, public_number, text, is_removed, reaction_count, final_rank, published_at")
    .in("event_id", ids)
    .eq("final_rank", 1);
  const winnerByEvent = new Map(
    (winners ?? []).map((row) => [row.event_id as string, row]),
  );

  const { data: monuments } = await db
    .from("public_monument_entries")
    .select("event_id, monument_number")
    .in("event_id", ids);
  const monumentByEvent = new Map(
    (monuments ?? []).map((row) => [row.event_id as string, row.monument_number as number]),
  );

  return sealed.map((row) => {
    const counts = counterById.get(row.id);
    return {
      id: row.id,
      editionNumber: row.edition_number ?? 1,
      slug: row.slug,
      title: row.title,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      finalizedAt: row.finalized_at,
      totalMessages: counts?.total_messages ?? 0,
      totalReactions: counts?.total_reactions ?? 0,
      archiveHash: row.archive_hash ?? null,
      merkleRoot: row.merkle_root ?? null,
      archiveUri: row.archive_uri ?? null,
      proofTx: row.proof_tx ?? null,
      winning: toHighlight(winnerByEvent.get(row.id) ?? null),
      monumentNumber: monumentByEvent.get(row.id) ?? null,
      themeQuestion: row.theme_question ?? null,
    };
  });
}

export async function loadSealedEdition(editionNumber: number): Promise<EventSnapshot> {
  if (isSimulation() || !hasSupabaseConfig()) {
    const stored = getSimulatedEdition(editionNumber);
    if (stored) {
      return { ...stored.event, serverNow: new Date().toISOString() };
    }
    if (isSimulatedWallClosed() && editionNumber === 1 && listSimulatedEditions().length === 0) {
      const { currentSimulatedEvent } = await import("@/lib/data/simulation");
      return currentSimulatedEvent();
    }
    throw new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, "Edition not found.", 404);
  }

  const { event } = await getEventByEdition(editionNumber);
  const snapshot = await getEventSnapshot(event.slug);
  if (snapshot.phase !== "archived") {
    throw new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, "Edition not found.", 404);
  }
  return snapshot;
}

export async function loadEditionLedger(event: EventSnapshot): Promise<PublicMessage[]> {
  if (isSimulation() || event.id === "local" || event.id.startsWith("local-")) {
    const stored = getSimulatedEdition(editionNumberOf(event));
    if (stored) return stored.messages;
    return listSimulatedMessages({ sort: "hot", limit: 10_000, eventId: event.id }).messages;
  }
  return remember(`ledger:${event.id}`, 3_600_000, () => allPublicMessages(event.id));
}

async function loadReactionStamps(eventId: string): Promise<ReactionStamp[] | null> {
  if (isSimulation() || eventId === "local" || eventId.startsWith("local-") || !hasSupabaseConfig()) {
    return null;
  }
  try {
    const db = createServiceSupabase();
    const stamps: ReactionStamp[] = [];
    const page = 1000;
    for (let from = 0; from < 2_000_000; from += page) {
      const { data, error } = await db
        .from("reactions")
        .select("message_id, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true })
        .range(from, from + page - 1);
      if (error) return null;
      const rows = data ?? [];
      for (const row of rows) {
        stamps.push({ messageId: row.message_id, createdAt: row.created_at });
      }
      if (rows.length < page) break;
    }
    return stamps;
  } catch {
    return null;
  }
}

async function cachedReactionStamps(eventId: string): Promise<ReactionStamp[] | null> {
  return remember(`stamps:${eventId}`, 3_600_000, async () => {
    const stamps = await loadReactionStamps(eventId);
    return stamps ?? [];
  }).then((rows) => (rows.length === 0 ? null : rows));
}

export async function loadEditionRecords(event: EventSnapshot): Promise<EditionRecords> {
  const messages = await loadEditionLedger(event);
  const stamps = await cachedReactionStamps(event.id);
  return recordsFromMessages(editionNumberOf(event), event, messages, stamps);
}

export async function loadCanonicalArchive(event: EventSnapshot) {
  if (isSimulation() || event.id === "local" || event.id.startsWith("local-")) {
    const frozen = getSimulatedEdition(editionNumberOf(event));
    if (!frozen) {
      throw new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, "Edition not found.", 404);
    }
    return buildCanonicalArchive({ event: frozen.event, messages: frozen.messages });
  }
  const messages = await loadEditionLedger(event);
  const sealed = buildCanonicalArchive({ event, messages });
  if (!event.archiveHash || !event.merkleRoot) {
    try {
      const db = createServiceSupabase();
      await db
        .from("events")
        .update({
          archive_hash: sealed.archiveHash,
          merkle_root: sealed.merkleRoot,
        })
        .eq("id", event.id)
        .is("archive_hash", null);
    } catch {
      // proof write is best-effort; the download still carries the hash
    }
  }
  return sealed;
}

export async function loadAllTimeRecords(): Promise<AllTimeRecords> {
  const editions = await listSealedEditions();
  if (editions.length === 0) return allTimeFromEditions([]);

  const peaks = new Map<number, number>();
  const books: EditionRecords[] = [];
  let mostFire: AllTimeRecords["mostFireOnMessage"] = null;

  for (const edition of editions) {
    const event = await loadSealedEdition(edition.editionNumber).catch(() => null);
    const stored = getSimulatedEdition(edition.editionNumber);
    const messages = event
      ? await loadEditionLedger(event)
      : stored?.messages ?? [];
    const stamps = event ? await cachedReactionStamps(event.id) : null;
    const book = recordsFromMessages(
      edition.editionNumber,
      event ?? {
        startsAt: edition.startsAt,
        endsAt: edition.endsAt,
        totalMessages: edition.totalMessages,
        totalReactions: edition.totalReactions,
      },
      messages,
      stamps,
    );
    books.push(book);
    peaks.set(edition.editionNumber, book.peakMessagesPerMinute);
    if (book.mostReacted && (!mostFire || book.mostReacted.reactionCount > mostFire.reactionCount)) {
      mostFire = {
        editionNumber: edition.editionNumber,
        publicNumber: book.mostReacted.publicNumber,
        reactionCount: book.mostReacted.reactionCount,
      };
    }
  }

  return allTimeFromEditions(editions, { mostFireOnMessage: mostFire, peaks, books });
}

export async function loadEditionMessage(editionNumber: number, publicNumber: number): Promise<PublicMessage> {
  const event = await loadSealedEdition(editionNumber);
  if (isSimulation() || event.id === "local" || event.id.startsWith("local-")) {
    return getSimulatedMessage(publicNumber, event.id);
  }
  const { getMessageByNumber } = await import("@/lib/data/messages");
  return getMessageByNumber(event.id, publicNumber);
}

export function summaryFromEvent(
  event: EventSnapshot,
  winning: PublicMessage | null,
): EditionSummary {
  return {
    id: event.id,
    editionNumber: editionNumberOf(event),
    slug: event.slug,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    finalizedAt: event.finalizedAt,
    totalMessages: event.totalMessages,
    totalReactions: event.totalReactions,
    archiveHash: event.archiveHash ?? null,
    merkleRoot: event.merkleRoot ?? null,
    archiveUri: event.archiveUri ?? null,
    proofTx: event.proofTx ?? null,
    winning: highlightFrom(winning),
  };
}
