// Client-side analytics. Fire-and-forget: never blocks the UI, never throws.
// Uses sendBeacon so events survive page unload (message_shared, etc.).

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

export type TrackMeta = Record<string, string | number | boolean | null>;

export function track(
  event: string,
  meta?: TrackMeta,
): void {
  if (typeof window === "undefined") return;
  if (!ALLOWED.has(event)) return;
  try {
    const payload = JSON.stringify({ event, meta: meta ?? undefined });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/events",
        new Blob([payload], { type: "application/json" }),
      );
    } else {
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // analytics must never break the Wall
  }
}
