import { jsonError, jsonOk } from "@/lib/http";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";
import { ensureAnonymousUser, peekAnonymousUser } from "@/lib/auth";

export async function GET() {
  try {
    if (isSimulation() || !hasSupabaseConfig()) {
      return jsonOk({
        configured: false,
        present: false,
        restored: false,
        created: false,
        simulation: isSimulation(),
      });
    }
    const user = await peekAnonymousUser();
    return jsonOk({
      configured: true,
      present: Boolean(user),
      restored: Boolean(user),
      created: false,
      simulation: isSimulation(),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (isSimulation() || !hasSupabaseConfig()) {
      return jsonOk({
        configured: false,
        present: false,
        restored: false,
        created: false,
        simulation: isSimulation(),
      });
    }
    const session = await ensureAnonymousUser(request);
    return jsonOk({
      configured: true,
      present: true,
      restored: session.restored,
      created: !session.restored,
      simulation: isSimulation(),
    });
  } catch (error) {
    return jsonError(error);
  }
}
