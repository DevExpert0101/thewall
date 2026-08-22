import "server-only";

import { remainingLabel, remainingMsFrom } from "@/lib/event/remaining";
import { readHealth } from "@/lib/health";
import { eventSlug, getEventOps, getEventSnapshot } from "@/lib/data/event";
import {
  currentSimulatedEvent,
  getSimulatedOps,
  listSimulatedIntents,
  simulatedMessageList,
} from "@/lib/data/simulation";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";
import { createServiceSupabase } from "@/lib/supabase/admin";
import type { AdminOpsSnapshot } from "@/lib/admin/types";
import type { EventSnapshot } from "@/lib/types";
import { defaultEventOps, type EventOpsControls } from "@/lib/ops/controls";

const WINDOW_MS = 15 * 60_000;
const DUPLICATE_REASONS = new Set(["TX_ALREADY_USED", "INTENT_FULFILLED"]);

function archivePrep(event: EventSnapshot): string {
  if (event.phase === "archived") {
    return event.archiveHash && event.merkleRoot ? "sealed" : "unverified";
  }
  if (event.phase === "finalizing") return "awaiting finish";
  return "not yet";
}

function perMinute(count: number, windowMs = WINDOW_MS): number {
  const minutes = windowMs / 60_000;
  return Math.round((count / minutes) * 10) / 10;
}

async function countExact(
  query: PromiseLike<{ count: number | null; error: { message?: string } | null }>,
): Promise<number> {
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

function simulatedOps(event: EventSnapshot, ops: EventOpsControls): AdminOpsSnapshot {
  const now = Date.now();
  const since = now - WINDOW_MS;
  const messages = simulatedMessageList(new Date(now));
  const recentMessages = messages.filter((row) => Date.parse(row.publishedAt) >= since).length;
  const intents = listSimulatedIntents();
  const removals = messages.filter((row) => row.isRemoved).length;
  return {
    event: {
      state: event.phase,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      remainingMs: remainingMsFrom(event.endsAt, now),
      remainingLabel: remainingLabel(event.endsAt, now),
    },
    traffic: {
      pageViewsLast15m: null,
      requestsLast15m: null,
      errorRate: null,
      activeViewers: null,
      note: "Page views are not counted in simulation. Unique viewers are never invented.",
    },
    messages: {
      total: event.totalMessages,
      perMinute: recentMessages > 0 ? perMinute(recentMessages) : 0,
      moderationFailures: 0,
    },
    payments: {
      intents: intents.length,
      successful: intents.filter((row) => row.status === "fulfilled").length,
      failed: intents.filter((row) => row.status === "expired").length,
      pending: intents.filter((row) => row.status === "created").length,
      duplicateReplay: 0,
    },
    reactions: {
      total: event.totalReactions,
      perMinute: null,
      suspiciousSpikes: 0,
    },
    system: {
      supabase: "simulation",
      payments: "simulation",
      realtime: "simulation",
      archivePrep: archivePrep(event),
    },
    moderation: {
      reports: 0,
      pendingReviews: 0,
      removals,
    },
    controls: ops,
  };
}

export async function loadAdminOps(
  event: EventSnapshot = currentSimulatedEvent(),
  extras: { suspiciousSpikes?: number } = {},
): Promise<AdminOpsSnapshot> {
  const ops = isSimulation() || !hasSupabaseConfig() ? getSimulatedOps() : await getEventOps();
  if (isSimulation() || !hasSupabaseConfig()) {
    const snapshot = simulatedOps(event, ops);
    snapshot.reactions.suspiciousSpikes = extras.suspiciousSpikes ?? 0;
    return snapshot;
  }

  const db = createServiceSupabase();
  const sinceIso = new Date(Date.now() - WINDOW_MS).toISOString();
  const health = await readHealth();

  const [
    pageViews,
    requests,
    recentMessages,
    rejected,
    intentCreated,
    intentFulfilled,
    intentCancelled,
    intentExpired,
    intentAll,
    failures,
    duplicates,
    recentReactions,
    openReports,
    pendingReviews,
    removals,
    realtimeProbe,
  ] = await Promise.all([
    countExact(
      db
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("name", "page_view")
        .gte("created_at", sinceIso),
    ),
    countExact(
      db.from("analytics_events").select("id", { count: "exact", head: true }).gte("created_at", sinceIso),
    ),
    countExact(
      db
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .gte("published_at", sinceIso),
    ),
    countExact(
      db
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("moderation_status", "rejected"),
    ),
    countExact(
      db
        .from("payment_intents")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "created"),
    ),
    countExact(
      db
        .from("payment_intents")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "fulfilled"),
    ),
    countExact(
      db
        .from("payment_intents")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "cancelled"),
    ),
    countExact(
      db
        .from("payment_intents")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "expired"),
    ),
    countExact(
      db.from("payment_intents").select("id", { count: "exact", head: true }).eq("event_id", event.id),
    ),
    countExact(db.from("payment_failures").select("id", { count: "exact", head: true })),
    countExact(
      db
        .from("payment_failures")
        .select("id", { count: "exact", head: true })
        .in("reason_code", [...DUPLICATE_REASONS]),
    ),
    countExact(
      db
        .from("reactions")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .gte("created_at", sinceIso),
    ),
    countExact(db.from("reports").select("id", { count: "exact", head: true }).eq("status", "open")),
    countExact(
      db
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .in("moderation_status", ["flagged", "pending"]),
    ),
    countExact(
      db
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("moderation_status", "removed"),
    ),
    db.from("public_message_events").select("id").limit(1),
  ]);

  const realtime =
    health.checks.supabase === "down"
      ? "down"
      : realtimeProbe.error
        ? "down"
        : health.checks.supabase === "ok"
          ? "configured"
          : health.checks.supabase;

  return {
    event: {
      state: event.phase,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      remainingMs: remainingMsFrom(event.endsAt, Date.now()),
      remainingLabel: remainingLabel(event.endsAt),
    },
    traffic: {
      pageViewsLast15m: pageViews,
      requestsLast15m: requests,
      errorRate: null,
      activeViewers: null,
      note: "Page views, last 15 min — not unique viewers. HTTP error rate is not collected.",
    },
    messages: {
      total: event.totalMessages,
      perMinute: perMinute(recentMessages),
      moderationFailures: rejected,
    },
    payments: {
      intents: intentAll,
      successful: intentFulfilled,
      failed: failures + intentCancelled + intentExpired,
      pending: intentCreated,
      duplicateReplay: duplicates,
    },
    reactions: {
      total: event.totalReactions,
      perMinute: perMinute(recentReactions),
      suspiciousSpikes: extras.suspiciousSpikes ?? 0,
    },
    system: {
      supabase: health.checks.supabase,
      payments: health.checks.payments,
      realtime,
      archivePrep: archivePrep(event),
    },
    moderation: {
      reports: openReports,
      pendingReviews,
      removals,
    },
    controls: ops ?? defaultEventOps(),
  };
}

export async function loadLaunchOps(): Promise<AdminOpsSnapshot> {
  const event = await getEventSnapshot(eventSlug());
  return loadAdminOps(event);
}
