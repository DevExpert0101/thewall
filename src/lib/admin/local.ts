import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { hmacSha256Hex, sha256Hex, tokensEqual } from "@/lib/crypto";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";

export const LOCAL_ADMIN_COOKIE = "thewall-admin-local";
export const LOCAL_ADMIN_ID = "00000000-0000-4000-8000-aaaaaaaaaaaa";
export const LOCAL_ADMIN_EMAIL_DEFAULT = "admin@thewall.local";
export const LOCAL_ADMIN_PASSWORD_DEFAULT = "thewall-local-admin";
export const LOCAL_ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;

let processSecret: string | null = null;

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

export function localAdminSecret(): string {
  const configured = process.env.ADMIN_LOCAL_SECRET?.trim();
  if (configured && configured.length >= 16) return configured;
  processSecret ??= randomBytes(32).toString("hex");
  return processSecret;
}

/** Default password is only for loopback. A LAN or preview origin must set its own password. */
export function localDefaultPasswordAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.ADMIN_LOCAL_ALLOW_DEFAULT === "1") return true;
  const site = (env.NEXT_PUBLIC_SITE_URL ?? "").toLowerCase();
  if (site && !site.includes("localhost") && !site.includes("127.0.0.1")) return false;
  return true;
}

export function localAdminCredentialsMatch(email: string, password: string): boolean {
  const emailOk = tokensEqual(sha256Hex(email.trim().toLowerCase()), sha256Hex(localAdminEmail()));
  const passwordOk = tokensEqual(sha256Hex(password), sha256Hex(localAdminPassword()));
  if (!emailOk || !passwordOk) return false;
  const usingDefault = tokensEqual(sha256Hex(password), sha256Hex(LOCAL_ADMIN_PASSWORD_DEFAULT));
  if (usingDefault && !localDefaultPasswordAllowed(process.env)) return false;
  return true;
}

export function signLocalAdminCookie(now = Date.now()): string {
  const issued = Math.floor(now / 1000).toString(10);
  const body = `${localAdminEmail()}|${issued}`;
  return `${body}|${hmacSha256Hex(localAdminSecret(), body)}`;
}

export function localAdminCookieValid(value: string | undefined, now = Date.now()): boolean {
  if (!value) return false;
  const parts = value.split("|");
  if (parts.length !== 3) return false;
  const [email, issuedRaw, mac] = parts;
  if (!email || !issuedRaw || !mac || mac.length !== 64) return false;
  const issued = Number(issuedRaw);
  if (!Number.isFinite(issued) || issued <= 0) return false;
  if (issued * 1000 + LOCAL_ADMIN_SESSION_TTL_SECONDS * 1000 < now) return false;
  const body = `${email}|${issuedRaw}`;
  const expected = hmacSha256Hex(localAdminSecret(), body);
  if (!tokensEqual(mac, expected)) return false;
  return tokensEqual(sha256Hex(email), sha256Hex(localAdminEmail()));
}

export async function markLocalAdmin(signedIn: boolean) {
  try {
    const jar = await cookies();
    if (signedIn) {
      jar.set(LOCAL_ADMIN_COOKIE, signLocalAdminCookie(), {
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        maxAge: LOCAL_ADMIN_SESSION_TTL_SECONDS,
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
    if (!localAdminCookieValid(value)) return null;
    return { id: LOCAL_ADMIN_ID, email: localAdminEmail() };
  } catch {
    return null;
  }
}
