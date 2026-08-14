import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { loadAdminHealth } from "@/lib/admin/data";
import { eventSlug, getEventSnapshot } from "@/lib/data/event";
import { payloadContainsSecret } from "@/lib/admin/sanitize";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    let eventStatus = "unknown";
    try {
      eventStatus = (await getEventSnapshot(eventSlug())).phase;
    } catch {
      eventStatus = "unavailable";
    }
    const health = await loadAdminHealth(eventStatus);
    if (payloadContainsSecret(health)) {
      throw new AppError(ERROR_CODES.UNAVAILABLE, "Health payload rejected.", 500);
    }
    return jsonOk(health);
  } catch (error) {
    return jsonError(error);
  }
}
