import { eventSlug, getEventSnapshot } from "@/lib/data/event";
import { simulatedTextAlreadyPublished } from "@/lib/data/simulation";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";
import { getModerationProvider } from "@/lib/moderation/rules";
import { canProceedToPayment } from "@/lib/moderation/types";
import { bindMessageHash } from "@/lib/payment/fulfillment";
import { validateMessage } from "@/lib/message/normalize";
import { rejectBeforePayment, type PublishPreflight } from "@/lib/publish/gate";
import { createServiceSupabase } from "@/lib/supabase/admin";

export type { PublishPreflight } from "@/lib/publish/gate";
export { assertCanCharge } from "@/lib/publish/gate";

async function isRepeatedOnThisWall(text: string): Promise<boolean> {
  if (isSimulation() || !hasSupabaseConfig()) {
    return simulatedTextAlreadyPublished(text);
  }
  try {
    const event = await getEventSnapshot(eventSlug());
    const db = createServiceSupabase();
    const { count } = await db
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("text_hash", bindMessageHash(text))
      .is("removed_at", null);
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Server validation + moderation before a wallet is opened. */
export async function preflightMessage(raw: string): Promise<PublishPreflight> {
  const text = validateMessage(raw);
  const moderation = await getModerationProvider().review({ text });
  if (!canProceedToPayment(moderation)) {
    rejectBeforePayment();
  }
  if (await isRepeatedOnThisWall(text)) {
    rejectBeforePayment();
  }
  return {
    text,
    moderationStatus: moderation.status,
    decision: moderation.decision,
  };
}
