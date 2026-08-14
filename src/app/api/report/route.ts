import { protectAnonymousWrite } from "@/lib/abuse/protect";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { reportSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = reportSchema.parse(await readJson(request));
    const user = await protectAnonymousWrite({ request, action: "report" });
    const db = createServiceSupabase();
    const { error } = await db.from("reports").insert({
      message_id: body.messageId,
      reporter_user_id: user.id,
      category: body.category,
      detail: body.detail ?? null,
      status: "open",
    });
    if (error) {
      throw error;
    }
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
