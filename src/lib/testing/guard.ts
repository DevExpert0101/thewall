import { AppError, ERROR_CODES } from "@/lib/errors";

const PRODUCTION_HOST =
  /(^|[./])thewall\.(com|io)$|(^|[./])www\.thewall\.(com|io)$/i;

export type TestTarget = "local" | "staging";

function flagOn(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function hostOf(value: string | undefined): string {
  if (!value?.trim()) return "";
  try {
    return new URL(value).hostname;
  } catch {
    return value.trim();
  }
}

/** Automated tests never touch mainnet money or a production origin. */
export function assertAutomatedTestSafe(env: NodeJS.ProcessEnv = process.env): void {
  if (env.VERCEL_ENV === "production" || flagOn(env.THEWALL_PRODUCTION)) {
    throw new AppError(ERROR_CODES.FORBIDDEN, "Automated tests must not run against production.", 403);
  }
  const network = (env.BASE_NETWORK ?? env.NEXT_PUBLIC_BASE_NETWORK ?? "base-sepolia").trim();
  if (network === "base") {
    throw new AppError(ERROR_CODES.FORBIDDEN, "Automated tests must not use Base mainnet.", 403);
  }
  const urls = [env.TEST_BASE_URL, env.NEXT_PUBLIC_SITE_URL, env.PLAYWRIGHT_BASE_URL];
  for (const url of urls) {
    if (url && PRODUCTION_HOST.test(hostOf(url))) {
      throw new AppError(ERROR_CODES.FORBIDDEN, "Automated tests must not use the production origin.", 403);
    }
  }
}

export function classifyTestTarget(env: NodeJS.ProcessEnv = process.env): TestTarget {
  assertAutomatedTestSafe(env);
  const url = env.TEST_BASE_URL ?? env.PLAYWRIGHT_BASE_URL ?? "";
  if (!url || /localhost|127\.0\.0\.1/i.test(url)) return "local";
  return "staging";
}

export function remoteTestBaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const url = env.TEST_BASE_URL?.trim() || env.PLAYWRIGHT_BASE_URL?.trim() || "";
  if (!url) return null;
  assertAutomatedTestSafe(env);
  return url.replace(/\/$/, "");
}
