import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAuthorized, unauthorized } from "@/lib/admin";

// Event controls: pause/resume submissions, or end the event manually (freeze).
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();

  const body = await req.json().catch(() => null);
  const action = body?.action;

  const { data: wall } = await supabase
    .from("walls")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!wall) {
    return Response.json({ error: "No wall found." }, { status: 500 });
  }

  if (action === "pause") {
    const { error } = await supabase
      .from("walls")
      .update({ accepting: false })
      .eq("id", wall.id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, state: "paused" });
  }

  if (action === "resume") {
    const { error } = await supabase
      .from("walls")
      .update({ accepting: true })
      .eq("id", wall.id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, state: "live" });
  }

  if (action === "freeze") {
    const { error } = await supabase
      .from("walls")
      .update({ frozen: true, ends_at: new Date().toISOString() })
      .eq("id", wall.id)
      .eq("frozen", false);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, state: "sealed" });
  }

  return Response.json({ error: "Invalid action." }, { status: 400 });
}
