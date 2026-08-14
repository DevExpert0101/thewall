import { z } from "zod";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { readClientIp } from "@/lib/abuse/ip";
export { TURNSTILE_DUMMY } from "@/lib/abuse/turnstile-keys";

const siteverifySchema = z.object({
  success: z.boolean(),
  "error-codes": z.array(z.string()).optional(),
});

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 8_000;

export function isTurnstileConfigured(): boolean {
  return Boolean(
    process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  );
}

function turnstileFailure(message = "Verification failed.", status = 400): AppError {
  return new AppError(ERROR_CODES.TURNSTILE, message, status);
}

export async function verifyTurnstileToken(
  token: string | undefined,
  request?: Request,
): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    throw new AppError(
      ERROR_CODES.UNAVAILABLE,
      "Abuse protection is not configured.",
      503,
    );
  }
  if (!token || token.length < 10) {
    throw turnstileFailure("Verification is required.");
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });
  const ip = request ? readClientIp(request) : null;
  if (ip) body.set("remoteip", ip);

  let response: Response;
  try {
    response = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
  } catch {
    throw turnstileFailure("Verification timed out. Try again.", 502);
  }

  if (!response.ok) {
    throw turnstileFailure("Verification failed.", 502);
  }

  const parsed = siteverifySchema.safeParse(await response.json());
  if (!parsed.success || parsed.data.success !== true) {
    throw turnstileFailure("Verification failed.");
  }
}
