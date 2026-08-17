import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { hashToken, tokensEqual } from "@/lib/crypto";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";
import { createServiceSupabase } from "@/lib/supabase/admin";

export const CLAIM_CHALLENGE_COOKIE = "tw_claim_challenge";
export const CLAIM_SESSION_COOKIE = "tw_claim_session";
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 10 * 60 * 1000;
const MISSING = hashToken("the-wall-missing-claim-challenge");

export type ClaimSession = {
  messageId: string;
  publicNumber: number;
  won: boolean;
};

type StoredChallenge = { expiresAt: number; consumed: boolean };
type StoredSession = StoredChallenge & ClaimSession;

const challenges = new Map<string, StoredChallenge>();
const sessions = new Map<string, StoredSession>();

function cookieOptions(maxAge: number) {
  return {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}

async function readCookie(name: string): Promise<string | null> {
  try {
    const jar = await cookies();
    return jar.get(name)?.value ?? null;
  } catch {
    return null;
  }
}

async function writeCookie(name: string, value: string, maxAge: number) {
  try {
    const jar = await cookies();
    jar.set(name, value, cookieOptions(maxAge));
  } catch {
    // tests and workers have no cookie store
  }
}

async function clearCookie(name: string) {
  try {
    const jar = await cookies();
    jar.delete(name);
  } catch {
    // ignore
  }
}

function persistLocalChallenge(hash: string, expiresAt: number) {
  challenges.set(hash, { expiresAt, consumed: false });
}

function persistLocalSession(hash: string, session: ClaimSession, expiresAt: number) {
  sessions.set(hash, { ...session, expiresAt, consumed: false });
}

export function resetClaimSessionState() {
  challenges.clear();
  sessions.clear();
}

export async function createClaimChallengeToken(): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const hash = hashToken(token);
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  persistLocalChallenge(hash, expiresAt);
  if (!isSimulation() && hasSupabaseConfig()) {
    try {
      const db = createServiceSupabase();
      await db.from("claim_challenges").insert({
        token_hash: hash,
        expires_at: new Date(expiresAt).toISOString(),
      });
    } catch {
      // local map still holds the challenge
    }
  }
  return token;
}

export async function issueClaimChallenge(): Promise<void> {
  const token = await createClaimChallengeToken();
  await writeCookie(CLAIM_CHALLENGE_COOKIE, token, Math.ceil(CHALLENGE_TTL_MS / 1000));
}

async function loadChallenge(hash: string): Promise<StoredChallenge | null> {
  const local = challenges.get(hash);
  if (local) return local;
  if (isSimulation() || !hasSupabaseConfig()) return null;
  try {
    const db = createServiceSupabase();
    const { data } = await db
      .from("claim_challenges")
      .select("expires_at, consumed_at")
      .eq("token_hash", hash)
      .maybeSingle();
    if (!data) return null;
    return {
      expiresAt: Date.parse(data.expires_at),
      consumed: Boolean(data.consumed_at),
    };
  } catch {
    return null;
  }
}

async function markChallengeConsumed(hash: string) {
  const local = challenges.get(hash);
  if (local) local.consumed = true;
  challenges.delete(hash);
  if (isSimulation() || !hasSupabaseConfig()) return;
  try {
    const db = createServiceSupabase();
    await db
      .from("claim_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("token_hash", hash)
      .is("consumed_at", null);
  } catch {
    // already invalidated locally
  }
}

export async function consumeClaimChallenge(tokenOverride?: string): Promise<void> {
  const token = tokenOverride ?? (await readCookie(CLAIM_CHALLENGE_COOKIE));
  const submitted = hashToken(token || "missing-claim-challenge");
  const stored = token ? await loadChallenge(submitted) : null;
  const dummy = stored ? hashToken("present") : MISSING;
  tokensEqual(dummy, stored ? hashToken("present") : submitted);
  await clearCookie(CLAIM_CHALLENGE_COOKIE);
  if (!token || !stored || stored.consumed || stored.expiresAt <= Date.now()) {
    throw new AppError(ERROR_CODES.CLAIM_CHALLENGE, "Start the claim from this page, then try again.", 401);
  }
  await markChallengeConsumed(submitted);
}

export async function createClaimSessionToken(session: ClaimSession): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const hash = hashToken(token);
  const expiresAt = Date.now() + SESSION_TTL_MS;
  persistLocalSession(hash, session, expiresAt);
  if (!isSimulation() && hasSupabaseConfig()) {
    try {
      const db = createServiceSupabase();
      await db.from("claim_sessions").insert({
        token_hash: hash,
        message_id: session.messageId,
        public_number: session.publicNumber,
        won: session.won,
        expires_at: new Date(expiresAt).toISOString(),
      });
    } catch {
      // local map still holds the session
    }
  }
  return token;
}

export async function issueClaimSession(session: ClaimSession): Promise<void> {
  const token = await createClaimSessionToken(session);
  await writeCookie(CLAIM_SESSION_COOKIE, token, Math.ceil(SESSION_TTL_MS / 1000));
}

async function loadSession(hash: string): Promise<StoredSession | null> {
  const local = sessions.get(hash);
  if (local) return local;
  if (isSimulation() || !hasSupabaseConfig()) return null;
  try {
    const db = createServiceSupabase();
    const { data } = await db
      .from("claim_sessions")
      .select("message_id, public_number, won, expires_at, consumed_at")
      .eq("token_hash", hash)
      .maybeSingle();
    if (!data) return null;
    return {
      messageId: data.message_id,
      publicNumber: data.public_number,
      won: Boolean(data.won),
      expiresAt: Date.parse(data.expires_at),
      consumed: Boolean(data.consumed_at),
    };
  } catch {
    return null;
  }
}

export async function readClaimSession(tokenOverride?: string): Promise<ClaimSession> {
  const token = tokenOverride ?? (await readCookie(CLAIM_SESSION_COOKIE));
  const submitted = hashToken(token || "missing-claim-session");
  const stored = token ? await loadSession(submitted) : null;
  const dummy = stored ? hashToken("present") : MISSING;
  tokensEqual(dummy, stored ? hashToken("present") : submitted);
  if (!token || !stored || stored.consumed || stored.expiresAt <= Date.now()) {
    throw new AppError(ERROR_CODES.CLAIM_CHALLENGE, "Prove ownership again before sending prize details.", 401);
  }
  return {
    messageId: stored.messageId,
    publicNumber: stored.publicNumber,
    won: stored.won,
  };
}

export async function invalidateClaimSession(tokenOverride?: string): Promise<void> {
  const token = tokenOverride ?? (await readCookie(CLAIM_SESSION_COOKIE));
  await clearCookie(CLAIM_SESSION_COOKIE);
  if (!token) return;
  const hash = hashToken(token);
  sessions.delete(hash);
  if (isSimulation() || !hasSupabaseConfig()) return;
  try {
    const db = createServiceSupabase();
    await db
      .from("claim_sessions")
      .update({ consumed_at: new Date().toISOString() })
      .eq("token_hash", hash);
  } catch {
    // cookie is already cleared
  }
}
