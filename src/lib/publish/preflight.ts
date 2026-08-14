import { AppError, ERROR_CODES } from "@/lib/errors";
import { validateMessage } from "@/lib/message/normalize";
import { getModerationProvider } from "@/lib/moderation/rules";
import { canProceedToPayment } from "@/lib/moderation/types";
import type { ModerationStatus } from "@/lib/moderation/types";

export type PublishPreflight = {
  text: string;
  moderationStatus: ModerationStatus;
};

/** Server validation + moderation before a wallet is opened. */
export async function preflightMessage(raw: string): Promise<PublishPreflight> {
  const text = validateMessage(raw);
  const moderation = await getModerationProvider().review({ text });
  if (!canProceedToPayment(moderation)) {
    throw new AppError(
      ERROR_CODES.MODERATION_REJECTED,
      "This message cannot be published.",
      422,
    );
  }
  return { text, moderationStatus: moderation.status };
}
