import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { eventSlug, getEventSnapshot } from "@/lib/data/event";
import { configPreviewFromEvent } from "@/lib/admin/data";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { adminEventSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { assertHistoricalTimestampEdit } from "@/lib/event/admin-edit";

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
    const event = await getEventSnapshot(eventSlug());
    const launched = new Date(event.startsAt).getTime() <= Date.now();
    assertHistoricalTimestampEdit({
      launched,
      changingWindow: Boolean(body.startsAt || body.endsAt),
      confirmed: body.confirmHistoricalEdit === true,
    });

    const patch: Record<string, string> = {};
    if (body.title) patch.title = body.title;
    if (body.startsAt) patch.starts_at = body.startsAt;
    if (body.endsAt) patch.ends_at = body.endsAt;

    if (Object.keys(patch).length === 0) {
      return jsonOk({ event: configPreviewFromEvent(event) });
    }

    const db = createServiceSupabase();
    const { error } = await db.from("events").update(patch).eq("id", event.id);
    if (error) {
      throw new AppError(ERROR_CODES.UNAVAILABLE, "Could not update event.", 503);
    }
    const next = await getEventSnapshot(eventSlug());
    return jsonOk({ event: configPreviewFromEvent(next) });
  } catch (error) {
    return jsonError(error);
  }
}
