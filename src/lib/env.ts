import { z } from "zod";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { BaseNetwork } from "@/lib/constants";

const address = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a 0x-prefixed 20-byte address");

const network = z.enum(["base", "base-sepolia"]);

function blankToUndefined(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function optionalUrl(value: unknown): unknown {
  const trimmed = blankToUndefined(value);
  if (typeof trimmed !== "string") return undefined;
  return z.string().url().safeParse(trimmed).success ? trimmed : undefined;
}

function optionalAddress(value: unknown): unknown {
  const trimmed = blankToUndefined(value);
  if (typeof trimmed !== "string") return undefined;
  return address.safeParse(trimmed).success ? trimmed : undefined;
}

function publicOrigin(value: unknown): unknown {
  const trimmed = blankToUndefined(value);
  if (typeof trimmed !== "string") return undefined;
  if (z.string().url().safeParse(trimmed).success) return trimmed;
  const hosted = `https://${trimmed.replace(/^\/+/, "")}`;
  return z.string().url().safeParse(hosted).success ? hosted : undefined;
}

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.preprocess(
    publicOrigin,
    z.string().url().default("http://localhost:3000"),
  ),
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(optionalUrl, z.string().url().optional()),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.preprocess(
    blankToUndefined,
    z.string().min(1).optional(),
  ),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.preprocess(
    blankToUndefined,
    z.string().min(1).optional(),
  ),
  NEXT_PUBLIC_EVENT_SLUG: z.preprocess(
    blankToUndefined,
    z.string().min(1).default("the-wall"),
  ),
  NEXT_PUBLIC_BASE_NETWORK: z.preprocess((value) => {
    const trimmed = blankToUndefined(value);
    if (typeof trimmed !== "string") return undefined;
    return network.safeParse(trimmed).success ? trimmed : undefined;
  }, network.default("base-sepolia")),
  NEXT_PUBLIC_TREASURY_ADDRESS: z.preprocess(optionalAddress, address.optional()),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(
    blankToUndefined,
    z.string().min(20).optional(),
  ),
  TURNSTILE_SECRET_KEY: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  BASE_TREASURY_ADDRESS: z.preprocess(blankToUndefined, address.optional()),
  BASE_NETWORK: z.preprocess(blankToUndefined, network.optional()),
  BASE_RPC_URL: z.preprocess(blankToUndefined, z.string().url().optional()),
  BASE_BUNDLER_URL: z.preprocess(blankToUndefined, z.string().url().optional()),
  ERROR_WEBHOOK_URL: z.preprocess(blankToUndefined, z.string().url().optional()),
  ADMIN_EMAILS: z.preprocess(blankToUndefined, z.string().optional()),
  PAYMENT_INTENT_TTL_SECONDS: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().positive().optional(),
  ),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

export function getPublicEnv(): PublicEnv {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_EVENT_SLUG: process.env.NEXT_PUBLIC_EVENT_SLUG,
    NEXT_PUBLIC_BASE_NETWORK: process.env.NEXT_PUBLIC_BASE_NETWORK,
    NEXT_PUBLIC_TREASURY_ADDRESS: process.env.NEXT_PUBLIC_TREASURY_ADDRESS,
  });
  if (!parsed.success) {
    throw new AppError(
      ERROR_CODES.CONFIG,
      "Public environment variables are invalid.",
      500,
    );
  }
  return parsed.data;
}

export function hasSupabaseConfig(): boolean {
  try {
    const env = getPublicEnv();
    return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  } catch {
    return false;
  }
}

function flagOn(value: string | undefined): boolean | null {
  if (value == null || value.trim() === "") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return null;
}

/** Local mock of the single Wall. Off in production unless explicitly enabled. */
export function isSimulation(): boolean {
  const flagged = flagOn(
    process.env.NEXT_PUBLIC_SIMULATE_LIVE ?? process.env.SIMULATE_LIVE,
  );
  if (flagged === true) return true;
  if (flagged === false) return false;
  return !hasSupabaseConfig();
}

/**
 * Freeze the same simulated Wall (not a previous event) so /archive can be reviewed.
 * Ignored unless simulation is already on.
 */
export function isArchiveSimulation(): boolean {
  if (!isSimulation()) return false;
  return (
    flagOn(process.env.NEXT_PUBLIC_SIMULATE_ARCHIVE ?? process.env.SIMULATE_ARCHIVE) ===
    true
  );
}

export function requireServerEnv(): ServerEnv & {
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
} {
  const pub = getPublicEnv();
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    BASE_TREASURY_ADDRESS: process.env.BASE_TREASURY_ADDRESS,
    BASE_NETWORK: process.env.BASE_NETWORK,
    BASE_RPC_URL: process.env.BASE_RPC_URL,
    BASE_BUNDLER_URL: process.env.BASE_BUNDLER_URL,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    ERROR_WEBHOOK_URL: process.env.ERROR_WEBHOOK_URL,
    PAYMENT_INTENT_TTL_SECONDS: process.env.PAYMENT_INTENT_TTL_SECONDS,
  });
  if (!parsed.success) {
    throw new AppError(
      ERROR_CODES.CONFIG,
      "Server environment variables are invalid.",
      500,
    );
  }
  if (!pub.NEXT_PUBLIC_SUPABASE_URL || !pub.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new AppError(
      ERROR_CODES.CONFIG,
      "Supabase public environment is not configured.",
      503,
    );
  }
  if (!parsed.data.SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError(
      ERROR_CODES.CONFIG,
      "SUPABASE_SERVICE_ROLE_KEY is required on the server.",
      503,
    );
  }
  const serverTreasury = parsed.data.BASE_TREASURY_ADDRESS;
  const publicTreasury = pub.NEXT_PUBLIC_TREASURY_ADDRESS;
  if (
    serverTreasury &&
    publicTreasury &&
    serverTreasury.toLowerCase() !== publicTreasury.toLowerCase()
  ) {
    throw new AppError(
      ERROR_CODES.CONFIG,
      "BASE_TREASURY_ADDRESS and NEXT_PUBLIC_TREASURY_ADDRESS must match.",
      500,
    );
  }
  return {
    ...parsed.data,
    NEXT_PUBLIC_SUPABASE_URL: pub.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function getNetwork(): BaseNetwork {
  const pub = getPublicEnv();
  const serverRaw = blankToUndefined(process.env.BASE_NETWORK);
  const publicRaw = blankToUndefined(process.env.NEXT_PUBLIC_BASE_NETWORK);
  if (typeof serverRaw === "string") {
    const parsed = network.safeParse(serverRaw);
    if (!parsed.success) {
      throw new AppError(ERROR_CODES.CONFIG, "BASE_NETWORK is invalid.", 500);
    }
    if (typeof publicRaw === "string") {
      const published = network.safeParse(publicRaw);
      if (published.success && published.data !== parsed.data) {
        throw new AppError(
          ERROR_CODES.CONFIG,
          "BASE_NETWORK and NEXT_PUBLIC_BASE_NETWORK must match.",
          500,
        );
      }
    }
    return parsed.data;
  }
  return pub.NEXT_PUBLIC_BASE_NETWORK;
}

export function getTreasuryAddress(): `0x${string}` {
  const pub = getPublicEnv();
  const server = blankToUndefined(process.env.BASE_TREASURY_ADDRESS);
  const value =
    typeof server === "string" ? server : pub.NEXT_PUBLIC_TREASURY_ADDRESS;
  const parsed = address.safeParse(value);
  if (!parsed.success) {
    throw new AppError(
      ERROR_CODES.CONFIG,
      "Treasury address is not configured.",
      503,
    );
  }
  return parsed.data as `0x${string}`;
}

export function getPublicTreasuryAddress(): `0x${string}` {
  const parsed = address.safeParse(getPublicEnv().NEXT_PUBLIC_TREASURY_ADDRESS);
  if (!parsed.success) {
    throw new AppError(
      ERROR_CODES.CONFIG,
      "NEXT_PUBLIC_TREASURY_ADDRESS is not configured.",
      503,
    );
  }
  return parsed.data as `0x${string}`;
}

export function isTestnet(): boolean {
  return getNetwork() === "base-sepolia";
}

export function adminEmailSet(): Set<string> {
  const raw = blankToUndefined(process.env.ADMIN_EMAILS);
  if (typeof raw !== "string") return new Set();
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const envContract = {
  publicSchema,
  serverSchema,
  blankToUndefined,
};
