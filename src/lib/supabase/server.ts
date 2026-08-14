import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseAnonConfig } from "@/lib/supabase/config";
import { supabaseCookieOptions } from "@/lib/supabase/cookies";

/** Cookie-backed server client for the signed-in (including anonymous) user. Anon key only. */
export async function createServerSupabase() {
  const { url, anonKey } = requireSupabaseAnonConfig();
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookieOptions: supabaseCookieOptions("server"),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies; src/proxy.ts refreshes the session.
        }
      },
    },
  });
}
