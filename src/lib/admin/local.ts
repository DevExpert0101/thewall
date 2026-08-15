import { cookies } from "next/headers";
import { sha256Hex, tokensEqual } from "@/lib/crypto";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";

export const LOCAL_ADMIN_COOKIE = "thewall-admin-local";
export const LOCAL_ADMIN_ID = "00000000-0000-4000-8000-aaaaaaaaaaaa";
export const LOCAL_ADMIN_EMAIL_DEFAULT = "admin@thewall.local";
export const LOCAL_ADMIN_PASSWORD_DEFAULT = "thewall-local-admin";

export function localAdminEnabled(): boolean {
  return isSimulation() && !hasSupabaseConfig();
}

export function localAdminEmail(): string {
  const raw = process.env.ADMIN_LOCAL_EMAIL?.trim().toLowerCase();
  return raw || LOCAL_ADMIN_EMAIL_DEFAULT;
}

function localAdminPassword(): string {
  const raw = process.env.ADMIN_LOCAL_PASSWORD;
  return raw && raw.length > 0 ? raw : LOCAL_ADMIN_PASSWORD_DEFAULT;
}

export function localAdminCredentialsMatch(email: string, password: string): boolean {
  const emailOk = tokensEqual(sha256Hex(email.trim().toLowerCase()), sha256Hex(localAdminEmail()));
  const passwordOk = tokensEqual(sha256Hex(password), sha256Hex(localAdminPassword()));
  return emailOk && passwordOk;
}

export async function markLocalAdmin(signedIn: boolean) {
  try {
    const jar = await cookies();
    if (signedIn) {
      jar.set(LOCAL_ADMIN_COOKIE, sha256Hex(localAdminEmail()), {
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        maxAge: 60 * 60 * 12,
      });
      return;
    }
    jar.delete(LOCAL_ADMIN_COOKIE);
  } catch {
    // no request cookie store
  }
}

export async function peekLocalAdmin(): Promise<{ id: string; email: string } | null> {
  if (!localAdminEnabled()) return null;
  try {
    const jar = await cookies();
    const value = jar.get(LOCAL_ADMIN_COOKIE)?.value;
    if (!value || !tokensEqual(value, sha256Hex(localAdminEmail()))) return null;
    return { id: LOCAL_ADMIN_ID, email: localAdminEmail() };
  } catch {
    return null;
  }
}
