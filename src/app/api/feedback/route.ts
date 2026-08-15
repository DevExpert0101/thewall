import { protectAnonymousWrite } from "@/lib/abuse/protect";
import { submitVisitorFeedback } from "@/lib/data/feedback";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { feedbackSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = feedbackSchema.parse(await readJson(request));
    await protectAnonymousWrite({ request, action: "feedback" });
    await submitVisitorFeedback({
      body: body.body,
      category: body.category,
      email: body.email || null,
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
