export type SessionResponse = {
  configured: boolean;
  present: boolean;
  restored: boolean;
  created: boolean;
  simulation?: boolean;
  error?: string;
  recovery?: string;
  code?: string;
};

async function parseSession(res: Response): Promise<SessionResponse> {
  const data = (await res.json().catch(() => ({}))) as SessionResponse & {
    error?: string;
    recovery?: string;
    code?: string;
  };
  if (!res.ok) {
    return {
      configured: data.configured ?? true,
      present: false,
      restored: false,
      created: false,
      error: data.error ?? "Could not start an anonymous session.",
      recovery: data.recovery,
      code: data.code,
    };
  }
  return {
    configured: Boolean(data.configured),
    present: Boolean(data.present),
    restored: Boolean(data.restored),
    created: Boolean(data.created),
    simulation: Boolean(data.simulation),
  };
}

/** Peek only. Never creates a Supabase user. Safe for diagnostics, not required for reading. */
export async function peekAnonymousSession(): Promise<SessionResponse> {
  const res = await fetch("/api/session", { method: "GET", credentials: "same-origin" });
  return parseSession(res);
}

/** Create an anonymous user only if the httpOnly cookie session is missing. */
export async function ensureAnonymousSession(): Promise<SessionResponse> {
  const res = await fetch("/api/session", { method: "POST", credentials: "same-origin" });
  return parseSession(res);
}
