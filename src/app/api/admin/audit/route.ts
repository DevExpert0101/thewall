import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { listAdminAudit } from "@/lib/admin/data";
import { payloadContainsSecret } from "@/lib/admin/sanitize";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const audit = await listAdminAudit();
    if (payloadContainsSecret(audit)) {
      throw new AppError(ERROR_CODES.UNAVAILABLE, "Audit payload rejected.", 500);
    }
    return jsonOk({ audit });
  } catch (error) {
    return jsonError(error);
  }
}
