import "server-only";

import { AppError, ERROR_CODES } from "@/lib/errors";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { assertDangerousConfirm } from "@/lib/admin/confirm";
import { mapPublishError } from "@/lib/data/rate-limit";
import { eventSlug, getEventSnapshot } from "@/lib/data/event";
import { recordAdminOpsAction } from "@/lib/ops/audit";
import type { ModerationReasonCode } from "@/lib/constants";

function rpcError(error: { message?: string } | null): never {
  throw mapPublishError(error?.message ?? "unavailable");
}

export async function moderateMessage(input: {
  adminId: string;
  adminEmail?: string;
  messageId: string;
  action: "remove" | "restore";
  reason: ModerationReasonCode;
  note?: string;
  confirm: boolean;
  confirmText: string;
}): Promise<{ ok: true; publicNumber: number; action: "remove" | "restore" }> {
  const db = createServiceSupabase();
  const { data: message } = await db
    .from("messages")
    .select("id, public_number")
    .eq("id", input.messageId)
    .maybeSingle();
  if (!message) {
    throw new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, "Message not found.", 404);
  }

  assertDangerousConfirm({
    confirm: input.confirm,
    confirmText: input.confirmText,
    action: input.action,
    publicNumber: message.public_number,
  });

  const { data, error } = await db.rpc("moderate_message", {
    p_message_id: input.messageId,
    p_administrator_id: input.adminId,
    p_action: input.action,
    p_reason_code: input.reason,
    p_note: input.note?.trim() || null,
    p_confirmed: true,
  });
  if (error) rpcError(error);

  const payload = (typeof data === "string" ? JSON.parse(data) : data) as {
    public_number?: number;
  };
  const result = {
    ok: true as const,
    publicNumber: payload.public_number ?? message.public_number,
    action: input.action,
  };
  try {
    const event = await getEventSnapshot(eventSlug());
    await recordAdminOpsAction({
      eventId: event.id,
      action: input.action,
      actor: { id: input.adminId, email: input.adminEmail ?? "operator" },
      before: { messageId: input.messageId, publicNumber: result.publicNumber },
      after: { action: input.action, reason: input.reason },
    });
  } catch {
    // Moderation already committed.
  }
  return result;
}

export async function dismissReport(input: {
  adminId: string;
  adminEmail?: string;
  reportId: string;
  reason: ModerationReasonCode;
  note?: string;
  confirm: boolean;
  confirmText: string;
}): Promise<{ ok: true }> {
  const db = createServiceSupabase();
  const { data: report } = await db
    .from("reports")
    .select("id, message_id")
    .eq("id", input.reportId)
    .maybeSingle();
  if (!report) {
    throw new AppError(ERROR_CODES.MESSAGE_NOT_FOUND, "Report not found.", 404);
  }
  const { data: message } = await db
    .from("messages")
    .select("public_number")
    .eq("id", report.message_id)
    .maybeSingle();

  assertDangerousConfirm({
    confirm: input.confirm,
    confirmText: input.confirmText,
    action: "dismiss",
    publicNumber: message?.public_number ?? null,
  });

  const { error } = await db.rpc("review_report", {
    p_report_id: input.reportId,
    p_administrator_id: input.adminId,
    p_reason_code: input.reason,
    p_note: input.note?.trim() || null,
    p_confirmed: true,
  });
  if (error) rpcError(error);
  try {
    const event = await getEventSnapshot(eventSlug());
    await recordAdminOpsAction({
      eventId: event.id,
      action: "dismiss",
      actor: { id: input.adminId, email: input.adminEmail ?? "operator" },
      before: { reportId: input.reportId },
      after: { reason: input.reason },
    });
  } catch {
    // Review already committed.
  }
  return { ok: true };
}
