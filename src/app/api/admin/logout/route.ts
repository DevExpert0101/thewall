import { markLocalAdmin } from "@/lib/admin/local";
import { jsonError, jsonOk } from "@/lib/http";
import { createServerSupabase } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await markLocalAdmin(false);
    if (hasSupabaseConfig()) {
      const supabase = await createServerSupabase();
      await supabase.auth.signOut();
    }
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
