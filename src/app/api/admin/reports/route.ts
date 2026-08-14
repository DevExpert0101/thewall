import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { dismissReport } from "@/lib/admin/actions";
import { listAdminReports } from "@/lib/admin/data";
import { adminReportReviewSchema } from "@/lib/validation";
import { payloadContainsSecret } from "@/lib/admin/sanitize";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const reports = await listAdminReports();
    if (payloadContainsSecret(reports)) {
      throw new AppError(ERROR_CODES.UNAVAILABLE, "Reports payload rejected.", 500);
    }
    return jsonOk({ reports });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = adminReportReviewSchema.parse(await readJson(request));
    const result = await dismissReport({
      adminId: admin.id,
      reportId: body.reportId,
      reason: body.reason,
      note: body.note,
      confirm: body.confirm,
      confirmText: body.confirmText,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
