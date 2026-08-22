import "server-only";

import { hasSupabaseConfig, isSimulation } from "@/lib/env";
import {
  listSimulatedOpsAudit,
  recordSimulatedOpsAction,
} from "@/lib/data/simulation";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { payloadContainsSecret } from "@/lib/admin/sanitize";
import type { AdminOpsAuditRow } from "@/lib/ops/controls";

export type { AdminOpsAuditRow };

export type AdminActor = {
  id: string;
  email: string;
};

function cleanPatch(value: Record<string, unknown>): Record<string, unknown> {
  if (payloadContainsSecret(value)) return { redacted: true };
  return value;
}

export async function recordAdminOpsAction(input: {
  eventId: string;
  action: string;
  actor: AdminActor;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}): Promise<void> {
  const row = {
    action: input.action.slice(0, 64),
    actorEmail: input.actor.email,
    before: cleanPatch(input.before ?? {}),
    after: cleanPatch(input.after ?? {}),
    createdAt: new Date().toISOString(),
  };

  if (isSimulation() || !hasSupabaseConfig()) {
    recordSimulatedOpsAction(row);
    return;
  }

  try {
    const db = createServiceSupabase();
    await db.from("admin_ops_actions").insert({
      event_id: input.eventId,
      action: row.action,
      actor_id: input.actor.id,
      actor_email: input.actor.email,
      before: row.before,
      after: row.after,
    });
  } catch {
    // Migration may not be applied yet. The primary action still stands.
  }
}

export async function listAdminOpsAudit(limit = 40): Promise<AdminOpsAuditRow[]> {
  if (isSimulation() || !hasSupabaseConfig()) {
    return listSimulatedOpsAudit(limit);
  }
  try {
    const db = createServiceSupabase();
    const { data } = await db
      .from("admin_ops_actions")
      .select("id, action, actor_email, before, after, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map((row) => ({
      id: String(row.id),
      action: String(row.action),
      actorEmail: String(row.actor_email ?? "operator"),
      before: (row.before as Record<string, unknown>) ?? {},
      after: (row.after as Record<string, unknown>) ?? {},
      createdAt: String(row.created_at),
    }));
  } catch {
    return [];
  }
}
