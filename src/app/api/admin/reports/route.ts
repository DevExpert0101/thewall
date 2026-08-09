import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAuthorized, unauthorized } from "@/lib/admin";

// Open reports, newest first, with the message preview so a moderator can
// triage without leaving the admin page.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();

  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, message_id, reason, details, status, created_at, messages(id, message_number, content, status, removed_at)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ reports: data });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();

  const body = await req.json().catch(() => null);
  const reportId = body?.reportId;
  const action = body?.action;

  if (typeof reportId !== "string" || !reportId) {
    return Response.json({ error: "Missing report id." }, { status: 400 });
  }
  if (action !== "resolve" && action !== "dismiss") {
    return Response.json({ error: "Invalid action." }, { status: 400 });
  }

  const { error } = await supabase
    .from("reports")
    .update({
      status: action === "resolve" ? "resolved" : "dismissed",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
