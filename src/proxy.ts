import { NextRequest } from "next/server";
import { withSupabaseSession } from "@/lib/supabase/proxy-client";
import { contentSecurityPolicy, pageScriptHashes } from "@/lib/security/csp";

let cachedProductionCsp: string | null = null;

async function pageCsp(): Promise<string> {
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) return contentSecurityPolicy("", true);
  if (cachedProductionCsp) return cachedProductionCsp;
  cachedProductionCsp = contentSecurityPolicy("", false, await pageScriptHashes());
  return cachedProductionCsp;
}

export async function proxy(request: NextRequest) {
  const csp = await pageCsp();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  const tagged = new NextRequest(request, { headers: requestHeaders });

  const response = await withSupabaseSession(tagged);
  response.headers.set("Content-Security-Policy", csp);

  const certificate = request.nextUrl.pathname.startsWith("/certificate");
  const admin =
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/api/admin");
  if (certificate) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
  }
  if (admin) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "private, no-store");
  }

  response.headers.set("X-Content-Type-Options", "nosniff");
  if (!certificate) {
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  }
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  if (process.env.VERCEL_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  return response;
}

/** HTML + cookie refresh only. Public read APIs and OG images skip Edge entirely. */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon$|api/|.*opengraph-image|.*twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
