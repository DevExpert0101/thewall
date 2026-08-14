import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { searchAdminMessages } from "@/lib/admin/data";
import { adminSearchSchema } from "@/lib/validation";
import { payloadContainsSecret } from "@/lib/admin/sanitize";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const raw = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (!raw) return jsonOk({ results: [] });
    const q = adminSearchSchema.parse({ q: raw }).q;
    const results = await searchAdminMessages(q);
    if (payloadContainsSecret(results)) {
      throw new AppError(ERROR_CODES.UNAVAILABLE, "Search payload rejected.", 500);
    }
    return jsonOk({ results });
  } catch (error) {
    return jsonError(error);
  }
}
