import { jsonOk } from "@/lib/http";
import { readHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await readHealth();
  return jsonOk(payload, { cache: "no-store" });
}

export async function HEAD() {
  const payload = await readHealth();
  return new Response(null, {
    status: payload.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
