import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { loadAdminOverview } from "@/lib/admin/data";
import { payloadContainsSecret } from "@/lib/admin/sanitize";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const overview = await loadAdminOverview();
    if (payloadContainsSecret(overview)) {
      throw new AppError(ERROR_CODES.UNAVAILABLE, "Overview payload rejected.", 500);
    }
    return jsonOk(overview);
  } catch (error) {
    return jsonError(error);
  }
}
