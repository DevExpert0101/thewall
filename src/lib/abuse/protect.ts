import { consumeRateLimit } from "@/lib/data/rate-limit";
import {
  ensureAnonymousUser,
  requireAnonymousUser,
  type AnonymousSession,
} from "@/lib/auth";
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
  forceTurnstile?: boolean;
};

export async function protectAnonymousWrite(options: ProtectOptions): Promise<AnonymousSession> {
  const { request, action, turnstileToken, forceTurnstile } = options;

  if (isSimulation()) {
    return { id: "local-sim", restored: true };
  }

  if (TURNSTILE_REQUIRED[action] || forceTurnstile) {
    await verifyTurnstileToken(turnstileToken, request);
  }

  const ipHash = clientIpHashForLimit(request);
  const [limit, windowSeconds] = ABUSE_LIMITS[action].ip;
  await consumeRateLimit(rateLimitKey(action, "ip", ipHash), limit, windowSeconds);

  const create = action !== "verify";
  const user = create
    ? await ensureAnonymousUser(request)
    : { ...(await requireAnonymousUser()), restored: true };

  const [userLimit, userWindow] = ABUSE_LIMITS[action].user;
  await consumeRateLimit(rateLimitKey(action, "user", user.id), userLimit, userWindow);

  return user;
}
