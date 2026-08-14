import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireServerEnv } from "@/lib/env";

let cached: SupabaseClient | null = null;

/**
 * Service-role client. Server-only.
 * Bypasses RLS — never import this module from a Client Component.
 * Reused per isolate so viral reads do not construct a client per query.
 */
export function createServiceSupabase() {
  if (cached) return cached;
  const env = requireServerEnv();
  cached = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return cached;
}