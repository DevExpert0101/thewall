import "server-only";

import { eventSlug, getEventSnapshot } from "@/lib/data/event";
import { getNetwork, hasSupabaseConfig } from "@/lib/env";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { buildAdminHealth, truncateWallet } from "@/lib/admin/sanitize";
import type {
  AdminAuditRow,
  AdminConfigPreview,
  AdminMessageHit,
  AdminOverview,
  AdminPaymentHit,
  AdminReportRow,
} from "@/lib/admin/types";
import { parsePublicNumber } from "@/lib/utils";

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

export async function loadAdminOverview(): Promise<AdminOverview> {
  const event = await getEventSnapshot(eventSlug());
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

  return {
    config: configPreviewFromEvent(event),
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
    openReports,
    flaggedMessages: (flagged.data ?? []).map((row) => ({
      id: row.id,
      publicNumber: row.public_number,
      moderationStatus: row.moderation_status,
    })),
    audit: auditLog,
    health: await loadAdminHealth(event.phase),
  };
}

export async function searchAdminMessages(q: string): Promise<AdminMessageHit[]> {
  const event = await getEventSnapshot(eventSlug());
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

export async function lookupAdminPayment(q: string): Promise<AdminPaymentHit | null> {
  const db = createServiceSupabase();
  const hash = q.trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(hash)) return null;

  const { data: payment } = await db
    .from("payments")
    .select(
      "transaction_hash, amount, currency, network, status, verified_at, sender_wallet, recipient_wallet, payment_intent_id",
    )
    .eq("transaction_hash", hash)
    .maybeSingle();
  if (!payment) return null;

  const { data: intent } = await db
    .from("payment_intents")
    .select("id, status")
    .eq("id", payment.payment_intent_id)
    .maybeSingle();
  const { data: message } = await db
    .from("messages")
    .select("public_number")
    .eq("payment_intent_id", payment.payment_intent_id)
    .maybeSingle();

  return {
    transactionHash: payment.transaction_hash,
    amount: String(payment.amount),
    currency: payment.currency,
    network: payment.network,
    status: payment.status,
    verifiedAt: payment.verified_at,
    sender: truncateWallet(payment.sender_wallet),
    recipient: truncateWallet(payment.recipient_wallet),
    intentStatus: intent?.status ?? null,
    publicNumber: message?.public_number ?? null,
  };
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
