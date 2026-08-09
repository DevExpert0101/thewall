import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAuthorized, unauthorized } from "@/lib/admin";

// Full-text-ish message search across every status (live, pending, removed)
// so a moderator can find and remove a voice from the record.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
  if (!q) {
    return Response.json({ messages: [] });
  }

  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, message_number, content, reactions, status, moderation_status, created_at, removed_at, removed_reason",
    )
    .ilike("content", `%${q}%`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ messages: data });
}
