import { consumeRateLimit } from "@/lib/data/rate-limit";
import { ensureAnonymousUser, requireAnonymousUser } from "@/lib/auth";
import { clientIpHashForLimit } from "@/lib/abuse/ip";
import {
  ABUSE_LIMITS,
  TURNSTILE_REQUIRED,
  rateLimitKey,
  type AbuseAction,
} from "@/lib/abuse/keys";
import { verifyTurnstileToken } from "@/lib/abuse/turnstile";
import { isSimulation } from "@/lib/env";

type ProtectOptions = {
  request: Request;
  action: AbuseAction;
  turnstileToken?: string;
};

export async function protectAnonymousWrite(options: ProtectOptions): Promise<{ id: string }> {
  const { request, action, turnstileToken } = options;

  if (isSimulation()) {
    return { id: "local-sim" };
  }

  if (TURNSTILE_REQUIRED[action]) {
    await verifyTurnstileToken(turnstileToken, request);
  }

  const ipHash = clientIpHashForLimit(request);
  const [limit, windowSeconds] = ABUSE_LIMITS[action].ip;
  await consumeRateLimit(rateLimitKey(action, "ip", ipHash), limit, windowSeconds);

  const create = action !== "verify";
  const user = create ? await ensureAnonymousUser(request) : await requireAnonymousUser();

  const [userLimit, userWindow] = ABUSE_LIMITS[action].user;
  await consumeRateLimit(rateLimitKey(action, "user", user.id), userLimit, userWindow);

  return user;
}
