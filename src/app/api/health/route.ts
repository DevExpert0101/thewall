import { jsonOk } from "@/lib/http";
import { readHealth, type HealthChecks } from "@/lib/health";

export const dynamic = "force-dynamic";

const down: { ok: false; checks: HealthChecks } = {
  ok: false,
  checks: {
    supabase: "down",
    payments: "missing",
    turnstile: "missing",
    event: "down",
    network: "unknown",
    simulation: true,
    timeAuthority: "database",
  },
};

export async function GET() {
  try {
    const payload = await readHealth();
    return jsonOk(payload, { cache: "no-store" });
  } catch {
    return jsonOk(down, { cache: "no-store" });
  }
}

export async function HEAD() {
  try {
    const payload = await readHealth();
    return new Response(null, {
      status: payload.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
