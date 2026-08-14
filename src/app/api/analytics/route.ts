import { analyticsSchema } from "@/lib/validation";
import { sanitizeAnalyticsMetadata } from "@/lib/analytics";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { hasSupabaseConfig } from "@/lib/env";
import { createServiceSupabase } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = analyticsSchema.parse(await readJson(request));
    const metadata = sanitizeAnalyticsMetadata(body.metadata);
    if (!hasSupabaseConfig()) {
      return jsonOk({ ok: true });
    }
    const db = createServiceSupabase();
    await db.from("analytics_events").insert({
      name: body.name,
      metadata,
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
