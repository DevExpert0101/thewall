import { buildCanonicalArchive } from "@/lib/archive/canonical";
import { allTimeFromEditions, highlightFrom, peakMessagesPerMinute, recordsFromMessages } from "@/lib/archive/records";
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

  const db = createServiceSupabase();
  const { data: events, error } = await db
    .from("events")
    .select(
      "id, slug, title, starts_at, ends_at, archived_at, finalized_at, edition_number, archive_hash, merkle_root, archive_uri, proof_tx",
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
    return phase === "archived" || phase === "finalizing";
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
  if (snapshot.phase !== "archived" && snapshot.phase !== "finalizing") {
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
  return allPublicMessages(event.id);
}

export async function loadEditionRecords(event: EventSnapshot): Promise<EditionRecords> {
  const messages = await loadEditionLedger(event);
  return recordsFromMessages(editionNumberOf(event), event, messages);
}

export async function loadCanonicalArchive(event: EventSnapshot) {
  if (isSimulation() || event.id === "local" || event.id.startsWith("local-")) {
    const frozen = getSimulatedEdition(editionNumberOf(event));
    if (!frozen) {
      throw new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, "Edition not found.", 404);
    }
    return buildCanonicalArchive({ event: frozen.event, messages: frozen.messages });
  }
  const messages = await allPublicMessages(event.id);
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
  let mostFire: AllTimeRecords["mostFireOnMessage"] = null;

  if (isSimulation() || !hasSupabaseConfig()) {
    for (const edition of editions) {
      const stored = getSimulatedEdition(edition.editionNumber);
      const messages = stored?.messages ?? [];
      peaks.set(edition.editionNumber, peakMessagesPerMinute(messages));
      const top = [...messages].sort((a, b) => b.reactionCount - a.reactionCount)[0];
      if (top && (!mostFire || top.reactionCount > mostFire.reactionCount)) {
        mostFire = {
          editionNumber: edition.editionNumber,
          publicNumber: top.publicNumber,
          reactionCount: top.reactionCount,
        };
      }
    }
    return allTimeFromEditions(editions, { mostFireOnMessage: mostFire, peaks });
  }

  const db = createServiceSupabase();
  const { data: hottest } = await db
    .from("public_messages")
    .select("event_id, public_number, reaction_count")
    .in(
      "event_id",
      editions.map((edition) => edition.id),
    )
    .order("reaction_count", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (hottest) {
    const edition = editions.find((row) => row.id === hottest.event_id);
    mostFire = {
      editionNumber: edition?.editionNumber ?? 1,
      publicNumber: hottest.public_number,
      reactionCount: hottest.reaction_count,
    };
  }

  for (const edition of editions) {
    const messages = await allPublicMessages(edition.id);
    peaks.set(edition.editionNumber, peakMessagesPerMinute(messages));
  }

  return allTimeFromEditions(editions, { mostFireOnMessage: mostFire, peaks });
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
