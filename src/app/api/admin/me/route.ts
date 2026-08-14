import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdmin();
    return jsonOk({ email: admin.email });
  } catch (error) {
    return jsonError(error);
  }
}
