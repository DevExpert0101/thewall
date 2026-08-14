import { AppError, ERROR_CODES } from "@/lib/errors";
import { getPublicEnv } from "@/lib/env";

export type SupabaseAnonConfig = {
  url: string;
  anonKey: string;
};

export function getSupabaseAnonConfig(): SupabaseAnonConfig | null {
  try {
    const env = getPublicEnv();
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return null;
    }
    return {
      url: env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
  } catch {
    return null;
  }
}

export function requireSupabaseAnonConfig(): SupabaseAnonConfig {
  const config = getSupabaseAnonConfig();
  if (!config) {
    throw new AppError(
      ERROR_CODES.CONFIG,
      "Supabase is not configured.",
      503,
    );
  }
  return config;
}
