import { redactSensitiveText } from "@/lib/abuse/redact";

export type ErrorReport = {
  message: string;
  digest?: string;
  path?: string;
  method?: string;
  routeType?: string;
};

function sanitize(value: string): string {
  return redactSensitiveText(value).slice(0, 500);
}

export function buildErrorReport(
  error: unknown,
  extra: Omit<ErrorReport, "message"> = {},
): ErrorReport {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "unknown";
  const digest =
    extra.digest ??
    (typeof error === "object" && error && "digest" in error
      ? String((error as { digest?: string }).digest ?? "")
      : undefined);
  return {
    message: sanitize(raw || "unknown"),
    digest: digest || undefined,
    path: extra.path ? sanitize(extra.path) : undefined,
    method: extra.method,
    routeType: extra.routeType,
  };
}

/** Server-side hook. Optional ERROR_WEBHOOK_URL; never send secrets or tokens. */
export async function reportServerError(
  error: unknown,
  extra: Omit<ErrorReport, "message"> = {},
): Promise<void> {
  const payload = buildErrorReport(error, extra);
  console.error(
    JSON.stringify({
      level: "error",
      source: "the-wall",
      ...payload,
    }),
  );
  const webhook = process.env.ERROR_WEBHOOK_URL?.trim();
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4_000),
    });
  } catch {
    // Monitoring must never take the request down.
  }
}
