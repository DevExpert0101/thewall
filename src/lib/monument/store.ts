import "server-only";

import { listSimulatedMonumentEntries, getSimulatedMonumentEntry, simulatedMonumentCapacity } from "@/lib/data/simulation";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";
import { isVercelProduction } from "@/lib/env/production";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { monumentCanvasFrom, monumentCanvasFromEnv } from "@/lib/monument/canvas";
import { monumentFromSealedWall } from "@/lib/monument/from-archive";
import { parseMonumentCapacity } from "@/lib/monument/policy";
import type { MonumentCatalog, MonumentEntry } from "@/lib/monument/types";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { ARCHIVAL_REMOVAL_TEXT } from "@/lib/constants";

type MonumentRow = {
  id: string;
  monument_number: number;
  position: number;
  x: number;
  y: number;
  width: number;
  height: number;
  sentence_snapshot: string;
  event_id: string;
  edition_number: number;
  theme_title: string;
  theme_slug: string | null;
  theme_question: string | null;
  theme_description: string | null;
  starts_at: string;
  ends_at: string;
  message_id: string;
  original_public_number: number;
  text: string;
  is_removed: boolean;
  final_reaction_count: number;
  final_rank: number;
  winning_margin: number;
  wall_total_messages: number;
  wall_total_reactions: number;
  published_at: string;
  sealed_at: string;
  archive_hash: string | null;
  merkle_root: string | null;
};

function fromRow(row: MonumentRow): MonumentEntry {
  return {
    id: row.id,
    monumentNumber: row.monument_number,
    position: row.position ?? row.monument_number,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    sentenceSnapshot: row.is_removed ? ARCHIVAL_REMOVAL_TEXT : (row.sentence_snapshot || row.text),
    eventId: row.event_id,
    editionNumber: row.edition_number,
    themeTitle: row.theme_title,
    themeSlug: row.theme_slug,
    themeQuestion: row.theme_question,
    themeDescription: row.theme_description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    messageId: row.message_id,
    originalPublicNumber: row.original_public_number,
    text: row.is_removed ? ARCHIVAL_REMOVAL_TEXT : row.text,
    isRemoved: row.is_removed,
    finalReactionCount: row.final_reaction_count,
    finalRank: 1,
    winningMargin: row.winning_margin,
    wallTotalMessages: row.wall_total_messages,
    wallTotalReactions: row.wall_total_reactions,
    publishedAt: row.published_at,
    sealedAt: row.sealed_at,
    archiveHash: row.archive_hash,
    merkleRoot: row.merkle_root,
  };
}

function emptyMonumentCatalog(): MonumentCatalog {
  const canvas = monumentCanvasFromEnv();
  return {
    entries: [],
    sealedCount: 0,
    capacity: parseMonumentCapacity(process.env.MONUMENT_CAPACITY),
    canvas,
  };
}

export async function listMonumentEntries(): Promise<MonumentCatalog> {
  if (isVercelProduction() && !hasSupabaseConfig()) {
    return emptyMonumentCatalog();
  }
  if (isSimulation() || !hasSupabaseConfig()) {
    const entries = listSimulatedMonumentEntries();
    const canvas = monumentCanvasFromEnv();
    return {
      entries,
      sealedCount: entries.length,
      capacity: simulatedMonumentCapacity(),
      canvas,
    };
  }

  const db = createServiceSupabase();
  const { data, error } = await db
    .from("public_monument_entries")
    .select(
      "id, monument_number, position, x, y, width, height, sentence_snapshot, event_id, edition_number, theme_title, theme_slug, theme_question, theme_description, starts_at, ends_at, message_id, original_public_number, text, is_removed, final_reaction_count, final_rank, winning_margin, wall_total_messages, wall_total_reactions, published_at, sealed_at, archive_hash, merkle_root",
    )
    .order("position", { ascending: true });
  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "The Monument could not be loaded.", 503);
  }
  const { data: state } = await db
    .from("monument_state")
    .select("capacity, canvas_width, canvas_height, cell_width, cell_height")
    .eq("singleton", true)
    .maybeSingle();
  const entries = ((data ?? []) as MonumentRow[]).map(fromRow);
  return {
    entries,
    sealedCount: entries.length,
    capacity: state?.capacity ?? parseMonumentCapacity(process.env.MONUMENT_CAPACITY),
    canvas: monumentCanvasFrom({
      width: state?.canvas_width,
      height: state?.canvas_height,
      cellWidth: state?.cell_width,
      cellHeight: state?.cell_height,
      capacity: state?.capacity,
    }),
  };
}

export async function loadMonumentEntry(monumentNumber: number): Promise<MonumentEntry> {
  if (isVercelProduction() && !hasSupabaseConfig()) {
    throw new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, "Monument entry not found.", 404);
  }
  if (isSimulation() || !hasSupabaseConfig()) {
    const entry = getSimulatedMonumentEntry(monumentNumber);
    if (!entry) {
      throw new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, "Monument entry not found.", 404);
    }
    return entry;
  }

  const db = createServiceSupabase();
  const { data, error } = await db
    .from("public_monument_entries")
    .select(
      "id, monument_number, position, x, y, width, height, sentence_snapshot, event_id, edition_number, theme_title, theme_slug, theme_question, theme_description, starts_at, ends_at, message_id, original_public_number, text, is_removed, final_reaction_count, final_rank, winning_margin, wall_total_messages, wall_total_reactions, published_at, sealed_at, archive_hash, merkle_root",
    )
    .eq("monument_number", monumentNumber)
    .maybeSingle();
  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "The Monument could not be loaded.", 503);
  }
  if (!data) {
    throw new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, "Monument entry not found.", 404);
  }
  return fromRow(data as MonumentRow);
}

export async function loadMonumentForEdition(editionNumber: number): Promise<MonumentEntry | null> {
  const catalog = await listMonumentEntries();
  return catalog.entries.find((entry) => entry.editionNumber === editionNumber) ?? null;
}

export function monumentFromLocalSeal(
  monumentNumber: number,
  event: Parameters<typeof monumentFromSealedWall>[0]["event"],
  messages: Parameters<typeof monumentFromSealedWall>[0]["messages"],
) {
  return monumentFromSealedWall({ monumentNumber, event, messages });
}
