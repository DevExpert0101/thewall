// In-memory sliding-window rate limiter. Single-instance only — swap for a
// shared store (Redis) if the Wall ever runs on multiple instances.
const buckets = new Map<string, number[]>();
const MAX_BUCKETS = 100_000;

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  let hits = buckets.get(key) ?? [];
  hits = hits.filter((t) => t > windowStart);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, arr] of buckets) {
      const live = arr.filter((t) => t > now - windowMs);
      if (live.length === 0) buckets.delete(k);
      else buckets.set(k, live);
    }
  }
  return true;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

export function tooManyRequests(): Response {
  return Response.json({ error: "Too many requests" }, { status: 429 });
}
