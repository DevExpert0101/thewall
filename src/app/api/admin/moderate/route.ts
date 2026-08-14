import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { moderateMessage } from "@/lib/admin/actions";
import { adminModerateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = adminModerateSchema.parse(await readJson(request));
    const result = await moderateMessage({
      adminId: admin.id,
      messageId: body.messageId,
      action: body.action,
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
