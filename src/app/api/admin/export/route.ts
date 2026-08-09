import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAuthorized, unauthorized } from "@/lib/admin";

// Full database export for the record: every message (all statuses) and every
// report. ?format=csv returns messages as a spreadsheet-ready CSV.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();

  const format = req.nextUrl.searchParams.get("format") ?? "json";

  const [{ data: messages }, { data: reports }] = await Promise.all([
    supabase
      .from("messages")
      .select(
        "id, message_number, content, reactions, status, moderation_status, created_at, removed_at, removed_reason",
      )
      .order("message_number", { ascending: true })
      .limit(10000),
    supabase
      .from("reports")
      .select("id, message_id, reason, details, status, created_at, resolved_at")
      .order("created_at", { ascending: true })
      .limit(10000),
  ]);

  if (format === "csv") {
    const header = [
      "message_number",
      "content",
      "reactions",
      "status",
      "moderation_status",
      "created_at",
      "removed_at",
      "removed_reason",
    ];
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      header.join(","),
      ...(messages ?? []).map((m: Record<string, unknown>) =>
        header.map((h) => esc(m[h])).join(","),
      ),
    ];
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="wall-export.csv"',
      },
    });
  }

  return Response.json({
    exported_at: new Date().toISOString(),
    messages: messages ?? [],
    reports: reports ?? [],
  });
}
