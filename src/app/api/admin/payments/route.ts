import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { lookupAdminPayment } from "@/lib/admin/data";
import { adminSearchSchema } from "@/lib/validation";
import { payloadContainsSecret } from "@/lib/admin/sanitize";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const raw = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (!raw) return jsonOk({ payment: null });
    const q = adminSearchSchema.parse({ q: raw }).q;
    const payment = await lookupAdminPayment(q);
    if (payloadContainsSecret(payment)) {
      throw new AppError(ERROR_CODES.UNAVAILABLE, "Payment payload rejected.", 500);
    }
    return jsonOk({ payment });
  } catch (error) {
    return jsonError(error);
  }
}
