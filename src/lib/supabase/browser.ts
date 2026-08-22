"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseAnonConfig } from "@/lib/supabase/config";
import { supabaseCookieOptions } from "@/lib/supabase/cookies";

/** Browser client: anon key only. Never import the service-role client here. */
export function createBrowserSupabase() {
  const { url, anonKey } = requireSupabaseAnonConfig();
  return createBrowserClient(url, anonKey, {
    cookieOptions: supabaseCookieOptions("browser"),
  });
}

/**
 * Optional Realtime client. Wall readers must not use this — they poll the
 * public beat. Does not persist a session, so browsing never writes auth.
 */
export function createRealtimeSupabase() {
  const { url, anonKey } = requireSupabaseAnonConfig();
  return createBrowserClient(url, anonKey, {
    cookieOptions: supabaseCookieOptions("browser"),
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
