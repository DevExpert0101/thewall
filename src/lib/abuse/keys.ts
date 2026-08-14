export const ABUSE_ACTIONS = [
  "session",
  "preflight",
  "intent",
  "verify",
  "react",
  "report",
  "admin_login",
  "certificate",
  "claim",
] as const;
export type AbuseAction = (typeof ABUSE_ACTIONS)[number];

export const ABUSE_LIMITS: Record<
  AbuseAction,
  { user: readonly [limit: number, windowSeconds: number]; ip: readonly [limit: number, windowSeconds: number] }
> = {
  session: { user: [10, 3600], ip: [20, 3600] },
  preflight: { user: [20, 60], ip: [40, 60] },
  intent: { user: [5, 60], ip: [10, 60] },
  verify: { user: [10, 60], ip: [20, 60] },
  react: { user: [30, 60], ip: [60, 60] },
  report: { user: [10, 60], ip: [20, 60] },
  admin_login: { user: [8, 900], ip: [8, 900] },
  certificate: { user: [30, 60], ip: [30, 60] },
  claim: { user: [8, 60], ip: [12, 60] },
};

export const TURNSTILE_REQUIRED: Record<AbuseAction, boolean> = {
  session: false,
  preflight: false,
  intent: true,
  verify: false,
  react: false,
  report: false,
  admin_login: false,
  certificate: false,
  claim: false,
};

export function rateLimitKey(action: AbuseAction, subject: "user" | "ip", id: string): string {
  return `${action}:${subject}:${id}`;
}
