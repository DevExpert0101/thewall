import { ARCHIVAL_TAGLINE } from "@/lib/constants";
import { lookupCertificate } from "@/lib/certificate/lookup";
import { jsonError, jsonOk } from "@/lib/http";
import { certificateQuerySchema } from "@/lib/validation";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { token } = certificateQuerySchema.parse({
      token: url.searchParams.get("token") ?? "",
    });
    const data = await lookupCertificate(token);
    if (hasSupabaseConfig()) {
      const db = createServiceSupabase();
      await db.from("analytics_events").insert({
        name: "certificate_viewed",
        metadata: { publicNumber: data.publicNumber },
      });
    }
    return jsonOk(
      { ...data, tagline: data.tagline || ARCHIVAL_TAGLINE },
      { cache: "private, no-store" },
    );
  } catch (error) {
    return jsonError(error);
  }
}
