const SECRET_KEY_RE =
  /secret|service.?role|private.?key|password|token_hash|anon_key|api.?key/i;
const JWT_RE = /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]+\./;
const PEM_RE = /-----BEGIN [A-Z ]+PRIVATE KEY-----/;

const STRIP_KEYS = [
  "token_hash",
  "token",
  "message_hash",
  "text_hash",
  "anonymous_user_id",
  "reporter_user_id",
  "password",
  "service_role",
  "serviceRole",
  "secret",
];

export function looksLikeSecret(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (JWT_RE.test(trimmed) || PEM_RE.test(trimmed)) return true;
  if (/SUPABASE_SERVICE_ROLE_KEY|TURNSTILE_SECRET_KEY|sk_live_/i.test(trimmed)) {
    return true;
  }
  return false;
}

const STATUS_WORDS = new Set(["configured", "missing", "ok", "down", "unknown", "unavailable"]);

export function payloadContainsSecret(value: unknown, depth = 0): boolean {
  if (depth > 8 || value == null) return false;
  if (typeof value === "string") return looksLikeSecret(value);
  if (Array.isArray(value)) {
    return value.some((entry) => payloadContainsSecret(entry, depth + 1));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(([key, entry]) => {
      if (SECRET_KEY_RE.test(key)) {
        if (typeof entry === "string" && STATUS_WORDS.has(entry)) return false;
        if (entry == null || entry === "") return false;
        return true;
      }
      return payloadContainsSecret(entry, depth + 1);
    });
  }
  return false;
}

export function presentSecret(value: string | undefined | null): "configured" | "missing" {
  return value && value.trim().length > 0 ? "configured" : "missing";
}

export function truncateWallet(address: string): string {
  const value = address.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) return "0x…";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function stripSensitiveAdminFields<T extends Record<string, unknown>>(
  row: T,
): Omit<T, (typeof STRIP_KEYS)[number]> {
  const out = { ...row };
  for (const key of STRIP_KEYS) {
    delete out[key];
  }
  return out;
}

export type AdminHealth = {
  database: "configured" | "missing";
  privilegedDb: "configured" | "missing";
  payments: "configured" | "missing";
  turnstile: "configured" | "missing";
  network: string;
  eventStatus: string;
  moderation: string;
};

export function buildAdminHealth(input: {
  supabase: boolean;
  serviceRole: string | undefined;
  payments: string | undefined;
  turnstileSecret: string | undefined;
  turnstileSiteKey: string | undefined;
  network: string;
  eventStatus: string;
}): AdminHealth {
  return {
    database: input.supabase ? "configured" : "missing",
    privilegedDb: presentSecret(input.serviceRole),
    payments: presentSecret(input.payments),
    turnstile:
      presentSecret(input.turnstileSecret) === "configured" &&
      presentSecret(input.turnstileSiteKey) === "configured"
        ? "configured"
        : "missing",
    network: input.network,
    eventStatus: input.eventStatus,
    moderation: "rules-v1",
  };
}
