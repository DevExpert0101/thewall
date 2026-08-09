import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAuthorized, unauthorized } from "@/lib/admin";

// Payment health: counts by status + the most recent payments.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();

  const { data, error } = await supabase.rpc("payment_status_counts");
  if (error) {
    // Fallback: compute counts client-side via grouped selects is not
    // available, so surface the error rather than silently lying.
    return Response.json({ error: error.message }, { status: 500 });
  }

  const { data: recent, error: recentErr } = await supabase
    .from("payments")
    .select(
      "id, status, coin, amount, confirmations, created_at, confirmed_at, messages(message_number, content)",
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (recentErr) {
    return Response.json({ error: recentErr.message }, { status: 500 });
  }

  return Response.json({ counts: data, recent });
}
