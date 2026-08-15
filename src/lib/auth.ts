import { AppError, ERROR_CODES } from "@/lib/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { adminEmailSet, hasSupabaseConfig } from "@/lib/env";
import { consumeRateLimit } from "@/lib/data/rate-limit";
import { clientIpHashForLimit } from "@/lib/abuse/ip";
import { ABUSE_LIMITS, rateLimitKey } from "@/lib/abuse/keys";
import { shouldCreateAnonymousUser } from "@/lib/abuse/session-policy";
import { resolveAdminAccess } from "@/lib/admin/access";
import { peekLocalAdmin } from "@/lib/admin/local";

export type AnonymousSession = {
  id: string;
  restored: boolean;
};

export { shouldCreateAnonymousUser } from "@/lib/abuse/session-policy";

export async function peekAnonymousUser(): Promise<{ id: string } | null> {
  if (!hasSupabaseConfig()) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user ? { id: data.user.id } : null;
}

export async function requireAnonymousUser(): Promise<{ id: string }> {
  const user = await peekAnonymousUser();
  if (!user) {
    throw new AppError(
      ERROR_CODES.UNAUTHENTICATED,
      "Anonymous session required.",
      401,
    );
  }
  return user;
}

/** Create a Supabase anonymous user only when no cookie session exists. */
export async function ensureAnonymousUser(request?: Request): Promise<AnonymousSession> {
  if (!hasSupabaseConfig()) {
    throw new AppError(
      ERROR_CODES.CONFIG,
      "Anonymous sessions are not configured.",
      503,
    );
  }

  const supabase = await createServerSupabase();
  const existing = await supabase.auth.getUser();
  const existingId = existing.data.user?.id;
  if (!shouldCreateAnonymousUser(existingId)) {
    return { id: existingId, restored: true };
  }

  if (request) {
    const ipHash = clientIpHashForLimit(request);
    const [limit, windowSeconds] = ABUSE_LIMITS.session.ip;
    await consumeRateLimit(rateLimitKey("session", "ip", ipHash), limit, windowSeconds);
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new AppError(
      ERROR_CODES.UNAUTHENTICATED,
      "Could not start an anonymous session.",
      401,
    );
  }
  return { id: data.user.id, restored: false };
}

export async function requireAdmin(): Promise<{ id: string; email: string }> {
  const local = await peekLocalAdmin();
  if (local) return local;

  if (!hasSupabaseConfig()) {
    throw new AppError(ERROR_CODES.CONFIG, "Administrator sign-in is not configured.", 503);
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase() ?? null;
  const userId = data.user?.id ?? null;

  if (error || !userId || !email) {
    throw new AppError(ERROR_CODES.FORBIDDEN, "Administrator sign-in required.", 401);
  }

  const db = createServiceSupabase();
  const { data: admin } = await db
    .from("admin_users")
    .select("auth_user_id, email")
    .eq("auth_user_id", userId)
    .maybeSingle();

  const allowlisted = email ? adminEmailSet().has(email) : false;
  const identity = resolveAdminAccess({
    authUserId: userId,
    email,
    adminRow: admin,
    allowlisted,
  });

  if (!admin && allowlisted && email) {
    await db.from("admin_users").upsert(
      { auth_user_id: userId, email },
      { onConflict: "auth_user_id" },
    );
  }

  return identity;
}

export async function peekAdmin(): Promise<{ id: string; email: string } | null> {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}
