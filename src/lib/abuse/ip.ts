import { createHash } from "node:crypto";

export { looksLikeIp, publicIpLeak, redactSensitiveText } from "@/lib/abuse/redact";

function pepper(): string {
  return (
    process.env.TURNSTILE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "thewall-dev-ip-pepper"
  );
}

/** Read the connecting address for server-to-Turnstile use only. Never serialize this. */
export function readClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim() ?? "";
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip")?.trim();
  return real || null;
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(`${pepper()}:${ip.trim()}`, "utf8").digest("hex");
}

/** Stable identifier for rate limits. Missing addresses share a tight unattributed bucket. */
export function clientIpHash(request: Request): string | null {
  const ip = readClientIp(request);
  if (!ip) return null;
  return hashIp(ip);
}

export function clientIpHashForLimit(request: Request): string {
  return clientIpHash(request) ?? hashIp("unattributed");
}
