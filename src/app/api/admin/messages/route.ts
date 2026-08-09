import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAuthorized, unauthorized } from "@/lib/admin";

// Removed messages, newest first — the moderation audit trail. Restore is the
// companion POST action below.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();

  const { data, error } = await supabase
    .from("messages")
    .select("id, message_number, content, reactions, removed_at, removed_reason")
    .eq("status", "removed")
    .order("removed_at", { ascending: false })
    .limit(100);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ messages: data });
}

// Emergency removal. The Wall is "permanent" — so removal is deliberate and
// audited: the message's number and original content stay in the database
// (visible only to moderators), but the message disappears from the live wall
// and the permanent record the moment status flips to 'removed'.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();

  const body = await req.json().catch(() => null);
  const messageId = body?.messageId;
  const action = body?.action;
  const reason =
    typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";

  if (typeof messageId !== "string" || !messageId) {
    return Response.json({ error: "Missing message id." }, { status: 400 });
  }

  if (action === "remove") {
    if (!reason) {
      return Response.json(
        { error: "A reason is required for removal." },
        { status: 400 },
      );
    }
    const { error } = await supabase
      .from("messages")
      .update({
        status: "removed",
        removed_at: new Date().toISOString(),
        removed_reason: reason,
      })
      .eq("id", messageId)
      .neq("status", "removed");
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Close any open reports on the message as part of the action.
    await supabase
      .from("reports")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("message_id", messageId)
      .eq("status", "open");

    return Response.json({ ok: true });
  }

  if (action === "restore") {
    const { error } = await supabase
      .from("messages")
      .update({
        status: "live",
        removed_at: null,
        removed_reason: null,
      })
      .eq("id", messageId)
      .eq("status", "removed");
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Invalid action." }, { status: 400 });
}
