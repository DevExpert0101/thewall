import { TURNSTILE_DUMMY } from "@/lib/abuse/turnstile-keys";
import { AppError, ERROR_CODES } from "@/lib/errors";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type ProductionEnvSnapshot = {
  vercelEnv?: string;
  siteUrl?: string;
  supabaseUrl?: string;
  anonKey?: string;
  serviceRole?: string;
  turnstileSite?: string;
  turnstileSecret?: string;
  publicNetwork?: string;
  serverNetwork?: string;
  publicTreasury?: string;
  serverTreasury?: string;
  simulateLive?: string;
  simulateArchive?: string;
  adminEmails?: string;
};

export function isVercelProduction(env = process.env.VERCEL_ENV): boolean {
  return env === "production";
}

/** `next build` prerender. Runtime requests must still fail closed. */
export function isNextProductionBuild(phase = process.env.NEXT_PHASE): boolean {
  return phase === "phase-production-build";
}

export function isDummyTurnstile(site?: string, secret?: string): boolean {
  const dummy = new Set<string>(Object.values(TURNSTILE_DUMMY));
  return Boolean((site && dummy.has(site)) || (secret && dummy.has(secret)));
}

function flagOn(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function looksLikeAddress(value: string | undefined): boolean {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));
}

/** Returns human-readable problems. Empty means the production contract is satisfied. */
export function evaluateProductionEnv(input: ProductionEnvSnapshot): string[] {
  const problems: string[] = [];
  const site = input.siteUrl?.replace(/\/$/, "") ?? "";
  if (!site || site.includes("localhost") || !site.startsWith("https://")) {
    problems.push("NEXT_PUBLIC_SITE_URL must be the public https origin.");
  }
  if (!input.supabaseUrl?.startsWith("https://") || !input.anonKey) {
    problems.push("Supabase URL and anon key are required.");
  }
  if (!input.serviceRole || input.serviceRole.length < 20) {
    problems.push("SUPABASE_SERVICE_ROLE_KEY is required on the server.");
  }
  if (isDummyTurnstile(input.turnstileSite, input.turnstileSecret) || !input.turnstileSite || !input.turnstileSecret) {
    problems.push("Cloudflare Turnstile must use a live site/secret pair.");
  }
  const network = input.serverNetwork || input.publicNetwork;
  if (network !== "base" && network !== "base-sepolia") {
    problems.push("BASE_NETWORK / NEXT_PUBLIC_BASE_NETWORK must be base or base-sepolia.");
  }
  if (
    input.serverNetwork &&
    input.publicNetwork &&
    input.serverNetwork !== input.publicNetwork
  ) {
    problems.push("BASE_NETWORK and NEXT_PUBLIC_BASE_NETWORK must match.");
  }
  const treasury = input.serverTreasury || input.publicTreasury;
  if (!looksLikeAddress(treasury) || treasury?.toLowerCase() === ZERO_ADDRESS) {
    problems.push("Treasury address must be a real wallet, not the zero address.");
  }
  if (
    input.serverTreasury &&
    input.publicTreasury &&
    input.serverTreasury.toLowerCase() !== input.publicTreasury.toLowerCase()
  ) {
    problems.push("BASE_TREASURY_ADDRESS and NEXT_PUBLIC_TREASURY_ADDRESS must match.");
  }
  if (flagOn(input.simulateLive) || flagOn(input.simulateArchive)) {
    problems.push("NEXT_PUBLIC_SIMULATE_LIVE and NEXT_PUBLIC_SIMULATE_ARCHIVE must be off in production.");
  }
  if (!input.adminEmails?.trim()) {
    problems.push("ADMIN_EMAILS must list at least one operator.");
  }
  return problems;
}

export function productionEnvFromProcess(
  env: NodeJS.ProcessEnv = process.env,
): ProductionEnvSnapshot {
  return {
    vercelEnv: env.VERCEL_ENV,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRole: env.SUPABASE_SERVICE_ROLE_KEY,
    turnstileSite: env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    turnstileSecret: env.TURNSTILE_SECRET_KEY,
    publicNetwork: env.NEXT_PUBLIC_BASE_NETWORK,
    serverNetwork: env.BASE_NETWORK,
    publicTreasury: env.NEXT_PUBLIC_TREASURY_ADDRESS,
    serverTreasury: env.BASE_TREASURY_ADDRESS,
    simulateLive: env.NEXT_PUBLIC_SIMULATE_LIVE ?? env.SIMULATE_LIVE,
    simulateArchive: env.NEXT_PUBLIC_SIMULATE_ARCHIVE ?? env.SIMULATE_ARCHIVE,
    adminEmails: env.ADMIN_EMAILS,
  };
}

/** Vercel (any env) or a non-localhost production host. Local `next dev` is not this. */
export function isHostedDeploy(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.VERCEL || env.VERCEL_ENV) return true;
  if (env.NODE_ENV !== "production") return false;
  const site = (env.NEXT_PUBLIC_SITE_URL ?? "").toLowerCase();
  return Boolean(site) && !site.includes("localhost") && !site.includes("127.0.0.1");
}

function throwIncompleteEnv(problems: string[], status: 500 | 503): never {
  console.error(
    JSON.stringify({
      level: "error",
      source: "the-wall",
      code: ERROR_CODES.CONFIG,
      problems,
    }),
  );
  throw new AppError(
    ERROR_CODES.CONFIG,
    status === 503
      ? "This site cannot take a $1 until it is fully configured."
      : "Production environment is incomplete.",
    status,
  );
}

export function assertProductionEnv(env: NodeJS.ProcessEnv = process.env): void {
  if (!isVercelProduction(env.VERCEL_ENV)) return;
  const problems = evaluateProductionEnv(productionEnvFromProcess(env));
  if (problems.length > 0) throwIncompleteEnv(problems, 500);
}

/** Paid and react routes. Hosted deploys must satisfy the production contract. */
export function assertPaidSurfaceConfigured(env: NodeJS.ProcessEnv = process.env): void {
  if (!isHostedDeploy(env)) return;
  const problems = evaluateProductionEnv(productionEnvFromProcess(env));
  if (problems.length > 0) throwIncompleteEnv(problems, 503);
}
