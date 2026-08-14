import { ImageResponse } from "next/og";
import { cacheForPhase, eventSlug, getEventSnapshot } from "@/lib/data/event";
import { getMessageByNumber } from "@/lib/data/messages";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { composeCreative, resolveCreativeRatio, type CreativeKind } from "@/lib/share/compose";
import { fallbackMonumentImage, renderCreativeImage } from "@/lib/share/render-creative";
import { parsePublicNumber } from "@/lib/utils";

export const runtime = "nodejs";

const KINDS = new Set<CreativeKind>(["countdown", "milestone", "message", "certificate"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kindRaw = url.searchParams.get("kind") ?? "countdown";
  const ratio = resolveCreativeRatio(url.searchParams.get("ratio") ?? "1200x630");
  if (!ratio) {
    return new Response("Invalid ratio. Use 1200x630, 1:1, or 9:16.", { status: 400 });
  }
  if (!KINDS.has(kindRaw as CreativeKind)) {
    return new Response("Invalid kind. Use countdown, milestone, message, or certificate.", {
      status: 400,
    });
  }
  const kind = kindRaw as CreativeKind;

  try {
    const event = await getEventSnapshot(eventSlug());
    let message;
    if (kind === "message" || kind === "certificate") {
      const n = parsePublicNumber(url.searchParams.get("number") ?? "");
      if (!n) {
        return new Response("Missing number.", { status: 400 });
      }
      message = await getMessageByNumber(event.id, n);
    }
    const copy = composeCreative({ kind, event, message });
    const image = renderCreativeImage(copy, ratio);
    image.headers.set("Cache-Control", cacheForPhase(event.phase));
    return image;
  } catch (error) {
    if (error instanceof AppError && error.code === ERROR_CODES.MESSAGE_NOT_FOUND) {
      return new Response("Message not found.", { status: 404 });
    }
    const image: ImageResponse = fallbackMonumentImage(ratio);
    image.headers.set("Cache-Control", "public, s-maxage=30");
    return image;
  }
}
