import "server-only";

import { listVisitorFeedback } from "@/lib/data/feedback";
import { listClaimAttempts } from "@/lib/ownership/claim";
import { listReactionSignals, type ReactionSignal } from "@/lib/reactions/integrity";
import { eventSlug, getEventOps, getEventSnapshot } from "@/lib/data/event";
import { listSealedEditions } from "@/lib/data/editions";
import {
  getSimulatedMessage,
  listSimulatedHeldMessages,
  listSimulatedMessages,
  listSimulatedPaymentRecords,
  lookupSimulatedPaymentRecord,
  simulatedAdminText,
  type SimulatedPaymentRecord,
} from "@/lib/data/simulation";
import { getNetwork, hasSupabaseConfig, isSimulation } from "@/lib/env";
import { editionNumberOf, parsePublicNumber } from "@/lib/utils";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { buildAdminHealth, truncateWallet } from "@/lib/admin/sanitize";
import { loadAdminOps } from "@/lib/admin/ops";
import { listAdminOpsAudit } from "@/lib/ops/audit";
import { defaultEventOps, type EventOpsControls } from "@/lib/ops/controls";
import type {
  AdminAuditRow,
  AdminConfigPreview,
  AdminMessageHit,
  AdminOverview,
  AdminPaymentHit,
  AdminReactionSignal,
  AdminReportRow,
} from "@/lib/admin/types";
import { publicIpLeak } from "@/lib/abuse/redact";

function toMessageHit(row: {
  id: string;
  public_number: number;
  text: string;
  reaction_count: number;
  published_at: string;
  removed_at: string | null;
  moderation_status: string;
  removal_reason_code: string | null;
}): AdminMessageHit {
  return {
    id: row.id,
    publicNumber: row.public_number,
    text: row.text,
    reactionCount: row.reaction_count,
    publishedAt: row.published_at,
    removedAt: row.removed_at,
    moderationStatus: row.moderation_status,
    removalReasonCode: row.removal_reason_code,
  };
}

export function configPreviewFromEvent(
  event: Awaited<ReturnType<typeof getEventSnapshot>>,
  ops: EventOpsControls = defaultEventOps(),
): AdminConfigPreview {
  return {
    title: event.title,
    slug: event.slug,
    phase: event.phase,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    archivedAt: event.archivedAt,
    finalizedAt: event.finalizedAt,
    network: event.network,
    treasuryAddress: event.treasuryAddress,
    priceUsdc: event.priceUsdc,
    totalMessages: event.totalMessages,
    totalReactions: event.totalReactions,
    editionNumber: editionNumberOf(event),
    themeSlug: event.themeSlug ?? null,
    themeQuestion: event.themeQuestion ?? null,
    themeDescription: event.themeDescription ?? null,
    monumentNumber: event.monumentNumber ?? null,
    archiveHash: event.archiveHash ?? null,
    merkleRoot: event.merkleRoot ?? null,
    archiveUri: event.archiveUri ?? null,
    proofTx: event.proofTx ?? null,
    windowMinutes: Math.max(
      1,
      Math.round((Date.parse(event.endsAt) - Date.parse(event.startsAt)) / 60_000),
    ),
    remainingMinutes: Math.max(0, Math.round((Date.parse(event.endsAt) - Date.now()) / 60_000)),
    publishEnabled: ops.publishEnabled,
    reactEnabled: ops.reactEnabled,
    strictBot: ops.strictBot,
  };
}

async function loadReviewRanks(eventId: string): Promise<AdminMessageHit[]> {
  if (isSimulation() || !hasSupabaseConfig()) {
    const held = listSimulatedHeldMessages();
    const live = listSimulatedMessages({ eventId, sort: "hot", limit: 25 }).messages.map((message) => ({
      id: message.id,
      publicNumber: message.publicNumber,
      text: simulatedAdminText(message.publicNumber),
      reactionCount: message.reactionCount,
      publishedAt: message.publishedAt,
      removedAt: message.isRemoved ? message.publishedAt : null,
      moderationStatus: message.isRemoved ? "removed" : "approved",
      removalReasonCode: message.isRemoved ? "other" : null,
    }));
    return [
      ...held.map((row) => ({
        id: row.id,
        publicNumber: row.publicNumber,
        text: row.text,
        reactionCount: 0,
        publishedAt: new Date().toISOString(),
        removedAt: null,
        moderationStatus: row.moderationStatus,
        removalReasonCode: null,
      })),
      ...live,
    ].slice(0, 25);
  }

  const db = createServiceSupabase();
  const { data } = await db
    .from("messages")
    .select(
      "id, public_number, text, reaction_count, published_at, removed_at, moderation_status, removal_reason_code",
    )
    .eq("event_id", eventId)
    .order("reaction_count", { ascending: false })
    .order("published_at", { ascending: true })
    .order("public_number", { ascending: true })
    .limit(25);
  return (data ?? []).map(toMessageHit);
}

async function monumentContext() {
  const editions = await listSealedEditions();
  return {
    simulation: isSimulation(),
    editions: editions.map((edition) => ({
      editionNumber: edition.editionNumber,
      title: edition.title,
      startsAt: edition.startsAt,
      endsAt: edition.endsAt,
      totalMessages: edition.totalMessages,
      totalReactions: edition.totalReactions,
      archiveHash: edition.archiveHash,
      merkleRoot: edition.merkleRoot,
    })),
  };
}

export async function loadAdminHealth(eventStatus = "unknown") {
  return buildAdminHealth({
    supabase: hasSupabaseConfig(),
    serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY,
    payments: process.env.BASE_TREASURY_ADDRESS ?? process.env.NEXT_PUBLIC_TREASURY_ADDRESS,
    turnstileSecret: process.env.TURNSTILE_SECRET_KEY,
    turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    network: getNetwork(),
    eventStatus,
  });
}

function toAdminSignal(row: ReactionSignal): AdminReactionSignal | null {
  const signal: AdminReactionSignal = {
    kind: row.kind,
    subject: row.subject,
    count: row.count,
    createdAt: row.createdAt,
    note: row.note,
  };
  if (publicIpLeak(signal)) return null;
  return signal;
}

async function loadReactionSignals(): Promise<AdminReactionSignal[]> {
  const memory = listReactionSignals().map(toAdminSignal).filter((row): row is AdminReactionSignal => row !== null);
  if (isSimulation() || !hasSupabaseConfig()) return memory;
  try {
    const db = createServiceSupabase();
    const { data } = await db
      .from("reaction_signals")
      .select("kind, subject, count, note, created_at")
      .order("created_at", { ascending: false })
      .limit(25);
    const fromDb = (data ?? [])
      .map((row) =>
        toAdminSignal({
          kind: row.kind as ReactionSignal["kind"],
          subject: row.subject as string,
          count: row.count as number,
          createdAt: row.created_at as string,
          note: row.note as string,
        }),
      )
      .filter((row): row is AdminReactionSignal => row !== null);
    const seen = new Set(memory.map((row) => `${row.kind}:${row.subject}:${row.createdAt}`));
    return [...memory, ...fromDb.filter((row) => !seen.has(`${row.kind}:${row.subject}:${row.createdAt}`))].slice(
      0,
      25,
    );
  } catch {
    return memory;
  }
}

async function loadClaimAttempts(): Promise<AdminOverview["claimAttempts"]> {
  try {
    const db = createServiceSupabase();
    const { data } = await db
      .from("claim_attempts")
      .select("public_number, outcome, created_at")
      .order("created_at", { ascending: false })
      .limit(25);
    return (data ?? []).map((row) => ({
      publicNumber: row.public_number as number,
      outcome: row.outcome as string,
      createdAt: row.created_at as string,
    }));
  } catch {
    return listClaimAttempts();
  }
}

export async function loadAdminOverview(): Promise<AdminOverview> {
  const event = await getEventSnapshot(eventSlug());
  const opsFlags = await getEventOps();
  if (isSimulation() || !hasSupabaseConfig()) {
    const reactionSignals = await loadReactionSignals();
    const recentPayments = listSimulatedPaymentRecords().map(toSimulatedPaymentHit);
    return {
      config: configPreviewFromEvent(event, opsFlags),
      totals: {
        messages: event.totalMessages,
        reactions: event.totalReactions,
        usdc: recentPayments.filter((row) => row.status === "completed").length,
      },
      recentFailures: [],
      recentPayments,
      openReports: [],
      flaggedMessages: listSimulatedHeldMessages(),
      reviewRanks: await loadReviewRanks(event.id),
      audit: [],
      health: await loadAdminHealth(event.phase),
      feedback: await listVisitorFeedback(),
      claimAttempts: listClaimAttempts(),
      reactionSignals,
      ops: await loadAdminOps(event, { suspiciousSpikes: reactionSignals.length }),
      opsAudit: await listAdminOpsAudit(),
      ...(await monumentContext()),
    };
  }
  const db = createServiceSupabase();

  const [failures, reports, flagged, audit, payments] = await Promise.all([
    db
      .from("payment_failures")
      .select("reason_code, created_at, transaction_hash")
      .order("created_at", { ascending: false })
      .limit(25),
    db
      .from("reports")
      .select("id, message_id, category, detail, status, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("messages")
      .select("id, public_number, moderation_status")
      .eq("event_id", event.id)
      .in("moderation_status", ["flagged", "pending"])
      .order("published_at", { ascending: false })
      .limit(50),
    db
      .from("moderation_actions")
      .select("id, message_id, action, reason, administrator_id, created_at")
      .order("created_at", { ascending: false })
      .limit(40),
    db
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
  ]);

  const messageIds = [
    ...new Set([
      ...(reports.data ?? []).map((row) => row.message_id),
      ...(audit.data ?? []).map((row) => row.message_id),
    ]),
  ];
  const adminIds = [...new Set((audit.data ?? []).map((row) => row.administrator_id))];

  const [{ data: messageRows }, { data: adminRows }] = await Promise.all([
    messageIds.length
      ? db.from("messages").select("id, public_number").in("id", messageIds)
      : Promise.resolve({ data: [] as { id: string; public_number: number }[] }),
    adminIds.length
      ? db.from("admin_users").select("auth_user_id, email").in("auth_user_id", adminIds)
      : Promise.resolve({ data: [] as { auth_user_id: string; email: string }[] }),
  ]);

  const numberById = new Map((messageRows ?? []).map((row) => [row.id, row.public_number]));
  const emailById = new Map((adminRows ?? []).map((row) => [row.auth_user_id, row.email]));

  const openReports: AdminReportRow[] = (reports.data ?? []).map((row) => ({
    id: row.id,
    messageId: row.message_id,
    publicNumber: numberById.get(row.message_id) ?? null,
    category: row.category,
    detail: row.detail,
    status: row.status,
    createdAt: row.created_at,
  }));

  const auditLog: AdminAuditRow[] = (audit.data ?? []).map((row) => ({
    id: row.id,
    messageId: row.message_id,
    publicNumber: numberById.get(row.message_id) ?? null,
    action: row.action,
    reason: row.reason,
    administratorEmail: emailById.get(row.administrator_id) ?? "operator",
    createdAt: row.created_at,
  }));

  const paymentTotal = payments.count ?? 0;

  const reactionSignals = await loadReactionSignals();
  return {
    config: configPreviewFromEvent(event, opsFlags),
    totals: {
      messages: event.totalMessages,
      reactions: event.totalReactions,
      usdc: paymentTotal,
    },
    recentFailures: (failures.data ?? []).map((row) => ({
      reasonCode: row.reason_code,
      createdAt: row.created_at,
      transactionHash: row.transaction_hash,
    })),
    recentPayments: await listLiveAdminPayments(event.id),
    openReports,
    flaggedMessages: (flagged.data ?? []).map((row) => ({
      id: row.id,
      publicNumber: row.public_number,
      moderationStatus: row.moderation_status,
    })),
    reviewRanks: await loadReviewRanks(event.id),
    audit: auditLog,
    health: await loadAdminHealth(event.phase),
    feedback: await listVisitorFeedback().catch(() => []),
    claimAttempts: await loadClaimAttempts(),
    reactionSignals,
    ops: await loadAdminOps(event, { suspiciousSpikes: reactionSignals.length }),
    opsAudit: await listAdminOpsAudit(),
    ...(await monumentContext()),
  };
}

export async function searchAdminMessages(q: string): Promise<AdminMessageHit[]> {
  const event = await getEventSnapshot(eventSlug());
  if (isSimulation() || !hasSupabaseConfig()) {
    const n = parsePublicNumber(q);
    if (n) {
      try {
        const message = getSimulatedMessage(n, event.id);
        const held = listSimulatedHeldMessages().find((row) => row.publicNumber === n);
        return [
          {
            id: message.id,
            publicNumber: message.publicNumber,
            text: held?.text ?? simulatedAdminText(message.publicNumber),
            reactionCount: message.reactionCount,
            publishedAt: message.publishedAt,
            removedAt: message.isRemoved ? message.publishedAt : null,
            moderationStatus: message.isRemoved ? "removed" : held ? "flagged" : "approved",
            removalReasonCode: message.isRemoved ? "other" : null,
          },
        ];
      } catch {
        return [];
      }
    }
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const heldHits = listSimulatedHeldMessages()
      .filter((row) => row.text.toLowerCase().includes(needle))
      .map((row) => ({
        id: row.id,
        publicNumber: row.publicNumber,
        text: row.text,
        reactionCount: 0,
        publishedAt: new Date().toISOString(),
        removedAt: null,
        moderationStatus: row.moderationStatus,
        removalReasonCode: null,
      }));
    const liveHits = listSimulatedMessages({ eventId: event.id, sort: "new", limit: 50 })
      .messages.filter((message) => simulatedAdminText(message.publicNumber).toLowerCase().includes(needle))
      .map((message) => ({
        id: message.id,
        publicNumber: message.publicNumber,
        text: simulatedAdminText(message.publicNumber),
        reactionCount: message.reactionCount,
        publishedAt: message.publishedAt,
        removedAt: message.isRemoved ? message.publishedAt : null,
        moderationStatus: message.isRemoved ? "removed" : "approved",
        removalReasonCode: message.isRemoved ? "other" : null,
      }));
    return [...heldHits, ...liveHits].slice(0, 25);
  }
  const db = createServiceSupabase();
  const columns =
    "id, public_number, text, reaction_count, published_at, removed_at, moderation_status, removal_reason_code";
  const n = parsePublicNumber(q);

  if (n) {
    const { data } = await db
      .from("messages")
      .select(columns)
      .eq("event_id", event.id)
      .eq("public_number", n)
      .maybeSingle();
    return data ? [toMessageHit(data)] : [];
  }

  if (/^[0-9a-f-]{36}$/i.test(q)) {
    const { data } = await db.from("messages").select(columns).eq("id", q).maybeSingle();
    return data ? [toMessageHit(data)] : [];
  }

  if (/^0x[0-9a-fA-F]{64}$/.test(q)) {
    const payment = await lookupAdminPayment(q);
    if (!payment?.publicNumber) return [];
    const { data } = await db
      .from("messages")
      .select(columns)
      .eq("event_id", event.id)
      .eq("public_number", payment.publicNumber)
      .maybeSingle();
    return data ? [toMessageHit(data)] : [];
  }

  const needle = q.replace(/[%_]/g, "").slice(0, 80);
  const { data } = await db
    .from("messages")
    .select(columns)
    .eq("event_id", event.id)
    .ilike("text", `%${needle}%`)
    .limit(25);
  return (data ?? []).map(toMessageHit);
}

function toSimulatedPaymentHit(row: SimulatedPaymentRecord): AdminPaymentHit {
  return {
    transactionHash: row.paymentId,
    amount: row.amount,
    currency: row.currency,
    network: row.network,
    status: row.status === "fulfilled" ? "completed" : row.status,
    verifiedAt: row.status === "fulfilled" ? row.createdAt : null,
    createdAt: row.createdAt,
    sender: "local",
    recipient: truncateWallet(row.recipient),
    intentStatus: row.status,
    publicNumber: row.publicNumber,
  };
}

function toLivePaymentHit(
  payment: {
    transaction_hash: string;
    amount: string | number;
    currency: string;
    network: string;
    status: string;
    verified_at: string | null;
    created_at: string;
    sender_wallet: string;
    recipient_wallet: string;
    payment_intent_id: string;
  },
  extras: { intentStatus: string | null; publicNumber: number | null },
): AdminPaymentHit {
  return {
    transactionHash: payment.transaction_hash,
    amount: String(payment.amount),
    currency: payment.currency,
    network: payment.network,
    status: payment.status,
    verifiedAt: payment.verified_at,
    createdAt: payment.created_at,
    sender: truncateWallet(payment.sender_wallet),
    recipient: truncateWallet(payment.recipient_wallet),
    intentStatus: extras.intentStatus,
    publicNumber: extras.publicNumber,
  };
}

const PAYMENT_COLUMNS =
  "transaction_hash, amount, currency, network, status, verified_at, created_at, sender_wallet, recipient_wallet, payment_intent_id";

async function attachLivePaymentExtras(
  rows: Array<{ payment_intent_id: string }>,
): Promise<{
  statusByIntent: Map<string, string>;
  numberByIntent: Map<string, number>;
}> {
  const db = createServiceSupabase();
  const intentIds = [...new Set(rows.map((row) => row.payment_intent_id))];
  if (intentIds.length === 0) {
    return { statusByIntent: new Map(), numberByIntent: new Map() };
  }
  const [{ data: intents }, { data: messages }] = await Promise.all([
    db.from("payment_intents").select("id, status").in("id", intentIds),
    db.from("messages").select("public_number, payment_intent_id").in("payment_intent_id", intentIds),
  ]);
  return {
    statusByIntent: new Map((intents ?? []).map((row) => [row.id as string, row.status as string])),
    numberByIntent: new Map(
      (messages ?? []).map((row) => [row.payment_intent_id as string, row.public_number as number]),
    ),
  };
}

async function listLiveAdminPayments(_eventId: string): Promise<AdminPaymentHit[]> {
  const db = createServiceSupabase();
  const { data } = await db
    .from("payments")
    .select(PAYMENT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(50);
  if (!data?.length) return [];
  const extras = await attachLivePaymentExtras(data);
  return data.map((row) =>
    toLivePaymentHit(row, {
      intentStatus: extras.statusByIntent.get(row.payment_intent_id) ?? null,
      publicNumber: extras.numberByIntent.get(row.payment_intent_id) ?? null,
    }),
  );
}

export async function lookupAdminPayment(q: string): Promise<AdminPaymentHit | null> {
  if (isSimulation() || !hasSupabaseConfig()) {
    const row = lookupSimulatedPaymentRecord(q);
    return row ? toSimulatedPaymentHit(row) : null;
  }

  const db = createServiceSupabase();
  const hash = q.trim().toLowerCase();
  const n = parsePublicNumber(q);

  if (/^0x[0-9a-f]{64}$/.test(hash)) {
    const { data: payment } = await db.from("payments").select(PAYMENT_COLUMNS).eq("transaction_hash", hash).maybeSingle();
    if (!payment) return null;
    const extras = await attachLivePaymentExtras([payment]);
    return toLivePaymentHit(payment, {
      intentStatus: extras.statusByIntent.get(payment.payment_intent_id) ?? null,
      publicNumber: extras.numberByIntent.get(payment.payment_intent_id) ?? null,
    });
  }

  if (n) {
    const event = await getEventSnapshot(eventSlug());
    const { data: message } = await db
      .from("messages")
      .select("payment_intent_id, public_number")
      .eq("event_id", event.id)
      .eq("public_number", n)
      .maybeSingle();
    if (!message) return null;
    const { data: payment } = await db
      .from("payments")
      .select(PAYMENT_COLUMNS)
      .eq("payment_intent_id", message.payment_intent_id)
      .maybeSingle();
    if (!payment) return null;
    const extras = await attachLivePaymentExtras([payment]);
    return toLivePaymentHit(payment, {
      intentStatus: extras.statusByIntent.get(payment.payment_intent_id) ?? null,
      publicNumber: message.public_number,
    });
  }

  return null;
}

export async function listAdminReports(): Promise<AdminReportRow[]> {
  const db = createServiceSupabase();
  const { data } = await db
    .from("reports")
    .select("id, message_id, category, detail, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const ids = [...new Set((data ?? []).map((row) => row.message_id))];
  const { data: messages } = ids.length
    ? await db.from("messages").select("id, public_number").in("id", ids)
    : { data: [] as { id: string; public_number: number }[] };
  const numberById = new Map((messages ?? []).map((row) => [row.id, row.public_number]));
  return (data ?? []).map((row) => ({
    id: row.id,
    messageId: row.message_id,
    publicNumber: numberById.get(row.message_id) ?? null,
    category: row.category,
    detail: row.detail,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function listAdminAudit(): Promise<AdminAuditRow[]> {
  const db = createServiceSupabase();
  const { data } = await db
    .from("moderation_actions")
    .select("id, message_id, action, reason, administrator_id, created_at")
    .order("created_at", { ascending: false })
    .limit(80);
  const messageIds = [...new Set((data ?? []).map((row) => row.message_id))];
  const adminIds = [...new Set((data ?? []).map((row) => row.administrator_id))];
  const [{ data: messages }, { data: admins }] = await Promise.all([
    messageIds.length
      ? db.from("messages").select("id, public_number").in("id", messageIds)
      : Promise.resolve({ data: [] as { id: string; public_number: number }[] }),
    adminIds.length
      ? db.from("admin_users").select("auth_user_id, email").in("auth_user_id", adminIds)
      : Promise.resolve({ data: [] as { auth_user_id: string; email: string }[] }),
  ]);
  const numberById = new Map((messages ?? []).map((row) => [row.id, row.public_number]));
  const emailById = new Map((admins ?? []).map((row) => [row.auth_user_id, row.email]));
  return (data ?? []).map((row) => ({
    id: row.id,
    messageId: row.message_id,
    publicNumber: numberById.get(row.message_id) ?? null,
    action: row.action,
    reason: row.reason,
    administratorEmail: emailById.get(row.administrator_id) ?? "operator",
    createdAt: row.created_at,
  }));
}
