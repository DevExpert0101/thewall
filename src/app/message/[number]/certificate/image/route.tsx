import { certificateFromPublic } from "@/lib/certificate/public";
import { renderCertificateImage } from "@/lib/certificate/render";
import { cacheForPhase, eventSlug, getEventSnapshot } from "@/lib/data/event";
import { getMessageByNumber } from "@/lib/data/messages";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { resolveCreativeRatio, type CreativeRatio } from "@/lib/share/compose";
import { parsePublicNumber } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ number: string }> },
) {
  const { number } = await context.params;
  const n = parsePublicNumber(number);
  if (!n) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const event = await getEventSnapshot(eventSlug());
    const message = await getMessageByNumber(event.id, n);
    const raw = new URL(request.url).searchParams.get("ratio");
    const ratio: CreativeRatio | "print" =
      raw === "print" ? "print" : (resolveCreativeRatio(raw) ?? "print");
    const image = renderCertificateImage(certificateFromPublic(event, message), ratio);
    image.headers.set("Cache-Control", cacheForPhase(event.phase));
    return image;
  } catch (error) {
    const status =
      error instanceof AppError && error.code === ERROR_CODES.MESSAGE_NOT_FOUND ? 404 : 503;
    return new Response("Not found", { status });
  }
}
