import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { eventSlug, getEventOps, getEventSnapshot } from "@/lib/data/event";
import { configPreviewFromEvent } from "@/lib/admin/data";
import { applyAdminEventControl } from "@/lib/admin/event-control";
import { adminEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const event = await getEventSnapshot(eventSlug());
    return jsonOk({ event: configPreviewFromEvent(event, await getEventOps()) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = adminEventSchema.parse(await readJson(request));
    const event = await applyAdminEventControl(body, admin);
    return jsonOk({ event });
  } catch (error) {
    return jsonError(error);
  }
}
