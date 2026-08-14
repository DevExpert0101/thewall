import type { CookieOptions } from "@supabase/ssr";

const FOUR_HUNDRED_DAYS = 400 * 24 * 60 * 60;

export function supabaseCookieOptions(kind: "server" | "browser"): CookieOptions {
  return {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: kind === "server",
    maxAge: FOUR_HUNDRED_DAYS,
  };
}

/** True when the request already has a Supabase auth cookie that needs refresh. */
export function hasSupabaseAuthCookie(
  cookies: readonly { name: string }[],
): boolean {
  return cookies.some((cookie) => cookie.name.startsWith("sb-"));
}
