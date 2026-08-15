import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { eventSlug, getEventSnapshot } from "@/lib/data/event";
import { configPreviewFromEvent } from "@/lib/admin/data";
import { applyAdminEventControl } from "@/lib/admin/event-control";
import { adminEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const event = await getEventSnapshot(eventSlug());
    return jsonOk({ event: configPreviewFromEvent(event) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = adminEventSchema.parse(await readJson(request));
    const event = await applyAdminEventControl(body);
    return jsonOk({ event });
  } catch (error) {
    return jsonError(error);
  }
}
