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
 * Realtime subscriber for public_message_events.
 * Does not persist a session, so browsing never writes auth to storage.
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
