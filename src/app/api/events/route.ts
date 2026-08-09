import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";

// The only events the Wall records. Everything else is dropped.
const ALLOWED = new Set([
  "landing_view",
  "wall_view",
  "message_start",
  "message_submitted",
  "checkout_started",
  "payment_started",
  "payment_confirmed",
  "message_published",
  "reaction_added",
  "message_shared",
  "certificate_viewed",
  "certificate_downloaded",
  "archive_viewed",
  "trending_viewed",
]);

const META_MAX = 800;

export async function POST(req: NextRequest) {
  if (!rateLimit(`events:${clientIp(req)}`, 240, 60_000)) {
    return tooManyRequests();
  }

  const body = await req.json().catch(() => null);
  const event = body?.event;
  if (typeof event !== "string" || !ALLOWED.has(event)) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const rawMeta =
    body?.meta && typeof body.meta === "object"
      ? JSON.stringify(body.meta).slice(0, META_MAX)
      : null;
  let meta: unknown = null;
  if (rawMeta) {
    try {
      meta = JSON.parse(rawMeta);
    } catch {
      meta = null;
    }
  }

  await supabase.from("analytics_events").insert({
    event,
    device_id:
      typeof body?.deviceId === "string"
        ? body.deviceId.slice(0, 100)
        : null,
    meta: meta ?? null,
  });

  return Response.json({ ok: true });
}
