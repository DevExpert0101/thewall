import { cache } from "react";
import { PRICE_USDC } from "@/lib/constants";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { deriveEventPhase } from "@/lib/event/state";
import { isVercelProduction } from "@/lib/env/production";
import {
  getNetwork,
  getTreasuryAddress,
  hasSupabaseConfig,
  isSimulation,
} from "@/lib/env";
import { currentSimulatedEvent, getSimulatedOps } from "@/lib/data/simulation";
import { defaultEventOps, parseEventOps, type EventOpsControls } from "@/lib/ops/controls";
import { EVENT_SNAPSHOT_TTL_MS, remember } from "@/lib/perf/ttl-cache";
import { createServiceSupabase } from "@/lib/supabase/admin";
import type { EventSnapshot } from "@/lib/types";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  ends_at: string;
  archived_at: string | null;
  finalized_at: string | null;
  edition_number?: number | null;
  theme_slug?: string | null;
  theme_question?: string | null;
  theme_description?: string | null;
  monument_entry_id?: string | null;
  archive_hash?: string | null;
  merkle_root?: string | null;
  archive_uri?: string | null;
  proof_tx?: string | null;
};

const EVENT_COLUMNS =
  "id, slug, title, starts_at, ends_at, archived_at, finalized_at, edition_number, theme_slug, theme_question, theme_description, archive_hash, merkle_root, archive_uri, proof_tx";

const finalizeInflight = new Map<string, Promise<EventRow>>();

export async function getEventBySlug(
  slug: string,
  options: { finalize?: boolean } = {},
): Promise<{
  event: EventRow;
  totalMessages: number;
  totalReactions: number;
}> {
  const db = createServiceSupabase();
  const { data: event, error } = await db
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Event could not be loaded.", 503);
  }
  if (!event) {
    throw new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, "Event not found.", 404);
  }

  const phase = deriveEventPhase({
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    archivedAt: event.archived_at,
    finalizedAt: event.finalized_at,
  });

  if (options.finalize === true && phase === "finalizing" && !event.finalized_at) {
    const pending = finalizeInflight.get(event.id);
    const work =
      pending ??
      (async () => {
        await db.rpc("finalize_event_rankings", { p_event_id: event.id });
        const { data: refreshed } = await db
          .from("events")
          .select(EVENT_COLUMNS)
          .eq("id", event.id)
          .single();
        return (refreshed as EventRow | null) ?? event;
      })();
    if (!pending) finalizeInflight.set(event.id, work);
    try {
      Object.assign(event, await work);
    } finally {
      if (!pending) finalizeInflight.delete(event.id);
    }
  }

  const { data: counters } = await db
    .from("event_counters")
    .select("total_messages, total_reactions")
    .eq("event_id", event.id)
    .maybeSingle();

  return {
    event,
    totalMessages: counters?.total_messages ?? 0,
    totalReactions: counters?.total_reactions ?? 0,
  };
}

async function resolveOpenEventSlug(preferredSlug: string): Promise<string> {
  const db = createServiceSupabase();
  const now = new Date().toISOString();
  const { data: open } = await db
    .from("events")
    .select("slug")
    .is("finalized_at", null)
    .gt("ends_at", now)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return open?.slug ?? preferredSlug;
}

async function snapshotFromSlug(slug: string, finalize: boolean): Promise<EventSnapshot> {
  if (isVercelProduction() && (isSimulation() || !hasSupabaseConfig())) {
    throw new AppError(
      ERROR_CODES.CONFIG,
      "The live Wall is not configured.",
      503,
    );
  }
  if (isSimulation() || !hasSupabaseConfig()) {
    return currentSimulatedEvent();
  }

  const currentSlug = await resolveOpenEventSlug(slug);
  const { event, totalMessages, totalReactions } = await getEventBySlug(currentSlug, { finalize });
  const phase = deriveEventPhase({
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    archivedAt: event.archived_at,
    finalizedAt: event.finalized_at,
  });

  let treasury: string | null = null;
  try {
    treasury = getTreasuryAddress();
  } catch {
    treasury = process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? null;
  }

  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    archivedAt: event.archived_at,
    finalizedAt: event.finalized_at,
    phase,
    serverNow: new Date().toISOString(),
    totalMessages,
    totalReactions,
    treasuryAddress: treasury,
    network: getNetwork(),
    priceUsdc: PRICE_USDC,
    editionNumber: event.edition_number ?? 1,
    themeSlug: event.theme_slug ?? null,
    themeQuestion: event.theme_question ?? null,
    themeDescription: event.theme_description ?? null,
    archiveHash: event.archive_hash ?? null,
    merkleRoot: event.merkle_root ?? null,
    archiveUri: event.archive_uri ?? null,
    proofTx: event.proof_tx ?? null,
  };
}

export async function getEventByEdition(
  editionNumber: number,
  options: { finalize?: boolean } = {},
): Promise<{
  event: EventRow;
  totalMessages: number;
  totalReactions: number;
}> {
  const db = createServiceSupabase();
  const { data: event, error } = await db
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("edition_number", editionNumber)
    .maybeSingle();

  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Event could not be loaded.", 503);
  }
  if (!event) {
    throw new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, "Edition not found.", 404);
  }
  return getEventBySlug(event.slug, options);
}

export function loadEventSnapshot(slug: string, finalize = false) {
  return snapshotFromSlug(slug, finalize);
}

/** Per-request dedupe, plus a short isolate TTL so viral polls share one snapshot. */
export const getEventSnapshot = cache((slug: string) => {
  if (isSimulation() || !hasSupabaseConfig()) {
    return snapshotFromSlug(slug, false);
  }
  return remember(`event:${slug}`, EVENT_SNAPSHOT_TTL_MS, () => snapshotFromSlug(slug, false));
});

export function eventSlug(): string {
  return process.env.NEXT_PUBLIC_EVENT_SLUG ?? "the-wall";
}

/** Kill switches. Not cached — emergency pauses must apply on the next write. */
export async function getEventOps(): Promise<EventOpsControls> {
  if (isSimulation() || !hasSupabaseConfig()) {
    return getSimulatedOps();
  }
  try {
    const db = createServiceSupabase();
    const slug = await resolveOpenEventSlug(eventSlug());
    const { data } = await db
      .from("events")
      .select("configuration")
      .eq("slug", slug)
      .maybeSingle();
    return parseEventOps(data?.configuration);
  } catch {
    return defaultEventOps();
  }
}

export async function readEventConfiguration(eventId: string): Promise<unknown> {
  if (isSimulation() || !hasSupabaseConfig()) return { ops: getSimulatedOps() };
  const db = createServiceSupabase();
  const { data } = await db.from("events").select("configuration").eq("id", eventId).maybeSingle();
  return data?.configuration ?? {};
}

export function cacheForPhase(phase: EventSnapshot["phase"]): string {
  if (phase === "archived") {
    return "public, s-maxage=3600, stale-while-revalidate=604800";
  }
  if (phase === "live") {
    return "public, s-maxage=3, stale-while-revalidate=10";
  }
  return "public, s-maxage=15, stale-while-revalidate=30";
}

/** Per-viewer count sync. Unique `ids` — do not put this on the shared CDN. */
export const PULSE_CACHE_CONTROL = "private, max-age=2, must-revalidate";

/** Shared wall beat: totals + latest number. Same URL for every reader. */
export const BEAT_CACHE_CONTROL = "public, s-maxage=2, stale-while-revalidate=8";

export function pulseCacheControl(hasIds: boolean): string {
  return hasIds ? PULSE_CACHE_CONTROL : BEAT_CACHE_CONTROL;
}
