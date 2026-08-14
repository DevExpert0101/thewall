import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonConfig } from "@/lib/supabase/config";
import { hasSupabaseAuthCookie, supabaseCookieOptions } from "@/lib/supabase/cookies";

/** Next.js 16 proxy helper: refresh existing auth cookies. Does not create users. */
export async function withSupabaseSession(request: NextRequest): Promise<NextResponse> {
  const passthrough = NextResponse.next({ request });
  const config = getSupabaseAnonConfig();
  if (!config) return passthrough;
  if (!hasSupabaseAuthCookie(request.cookies.getAll())) return passthrough;

  let response = passthrough;
  const supabase = createServerClient(config.url, config.anonKey, {
    cookieOptions: supabaseCookieOptions("server"),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}
