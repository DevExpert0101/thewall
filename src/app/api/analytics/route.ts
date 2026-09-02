import { analyticsSchema } from "@/lib/validation";
import { sanitizeAnalyticsMetadata } from "@/lib/analytics";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { hasSupabaseConfig } from "@/lib/env";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/data/rate-limit";
import { clientIpHashForLimit } from "@/lib/abuse/ip";
import { ABUSE_LIMITS, rateLimitKey } from "@/lib/abuse/keys";

export async function POST(request: Request) {
  try {
    const ipHash = clientIpHashForLimit(request);
    const [limit, windowSeconds] = ABUSE_LIMITS.analytics.ip;
    await consumeRateLimit(rateLimitKey("analytics", "ip", ipHash), limit, windowSeconds);
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
