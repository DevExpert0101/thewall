import { looksLikeIp } from "@/lib/abuse/redact";
import { looksLikeOwnershipSecret } from "@/lib/ownership/wall-key";

export const ANALYTIC_EVENTS = [
  "page_view",
  "compose_started",
  "payment_initiated",
  "payment_verified",
  "message_published",
  "reaction",
  "share",
  "certificate_viewed",
] as const;

export type AnalyticEventName = (typeof ANALYTIC_EVENTS)[number];

const FORBIDDEN_KEYS = [
  "message",
  "text",
  "wallet",
  "address",
  "token",
  "email",
  "ip",
  "hash",
  "secret",
  "key",
  "wallkey",
  "claimkey",
  "ownership",
];

export function sanitizeAnalyticsMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> {
  if (!metadata) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_KEYS.some((k) => lower.includes(k))) continue;
    if (typeof value === "string" && (looksLikeIp(value) || looksLikeOwnershipSecret(value))) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
    }
  }
  return out;
}
