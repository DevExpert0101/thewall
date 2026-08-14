import { getNetwork, hasSupabaseConfig, isSimulation } from "@/lib/env";
import { isDummyTurnstile } from "@/lib/env/production";
import { createServiceSupabase } from "@/lib/supabase/admin";

export type HealthStatus = "ok" | "missing" | "down";

export type HealthChecks = {
  supabase: HealthStatus;
  payments: HealthStatus;
  turnstile: HealthStatus;
  event: HealthStatus;
  network: "base" | "base-sepolia" | "unknown";
  simulation: boolean;
  timeAuthority: "database";
};

export function classifyTurnstile(site?: string, secret?: string): HealthStatus {
  if (!site || !secret) return "missing";
  if (isDummyTurnstile(site, secret)) return "missing";
  return "ok";
}

export function classifyPayments(treasury?: string): HealthStatus {
  if (!treasury || !/^0x[a-fA-F0-9]{40}$/.test(treasury)) return "missing";
  if (treasury.toLowerCase() === "0x0000000000000000000000000000000000000000") {
    return "missing";
  }
  return "ok";
}

export async function readHealth(): Promise<{ ok: boolean; checks: HealthChecks }> {
  let network: HealthChecks["network"] = "unknown";
  try {
    network = getNetwork();
  } catch {
    network = "unknown";
  }

  const checks: HealthChecks = {
    supabase: hasSupabaseConfig() ? "ok" : "missing",
    payments: classifyPayments(
      process.env.BASE_TREASURY_ADDRESS || process.env.NEXT_PUBLIC_TREASURY_ADDRESS,
    ),
    turnstile: classifyTurnstile(
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      process.env.TURNSTILE_SECRET_KEY,
    ),
    event: "missing",
    network,
    simulation: isSimulation(),
    timeAuthority: "database",
  };

  if (hasSupabaseConfig() && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const db = createServiceSupabase();
      const { error } = await db.from("events").select("id").limit(1);
      checks.supabase = error ? "down" : "ok";
      checks.event = error ? "down" : "ok";
    } catch {
      checks.supabase = "down";
      checks.event = "down";
    }
  }

  const ok =
    checks.supabase === "ok" &&
    checks.payments === "ok" &&
    checks.turnstile === "ok" &&
    checks.event === "ok" &&
    checks.network !== "unknown" &&
    checks.simulation === false;

  return { ok, checks };
}
