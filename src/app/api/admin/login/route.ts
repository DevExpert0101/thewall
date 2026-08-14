import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { createServerSupabase } from "@/lib/supabase/server";
import { adminLoginSchema } from "@/lib/validation";
import { consumeRateLimit } from "@/lib/data/rate-limit";
import { clientIpHashForLimit, hashIp } from "@/lib/abuse/ip";
import { ABUSE_LIMITS, rateLimitKey } from "@/lib/abuse/keys";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { hasSupabaseConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!hasSupabaseConfig()) {
      throw new AppError(ERROR_CODES.CONFIG, "Administrator sign-in is not configured.", 503);
    }

    const ipHash = clientIpHashForLimit(request);
    const [ipLimit, ipWindow] = ABUSE_LIMITS.admin_login.ip;
    await consumeRateLimit(rateLimitKey("admin_login", "ip", ipHash), ipLimit, ipWindow);

    const body = adminLoginSchema.parse(await readJson(request));
    const [userLimit, userWindow] = ABUSE_LIMITS.admin_login.user;
    await consumeRateLimit(
      rateLimitKey("admin_login", "user", hashIp(`admin-email:${body.email.trim().toLowerCase()}`)),
      userLimit,
      userWindow,
    );

    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.signInWithPassword({
      email: body.email.trim(),
      password: body.password,
    });
    if (error) {
      throw new AppError(ERROR_CODES.FORBIDDEN, "Sign-in failed.", 401);
    }

    try {
      const admin = await requireAdmin();
      return jsonOk({ email: admin.email });
    } catch (inner) {
      await supabase.auth.signOut();
      throw inner;
    }
  } catch (error) {
    return jsonError(error);
  }
}
