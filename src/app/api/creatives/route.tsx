import { loadEditionMessage, loadSealedEdition } from "@/lib/data/editions";
import { cacheForPhase, eventSlug, getEventSnapshot } from "@/lib/data/event";
import { getMessageByNumber } from "@/lib/data/messages";
import { hasReachedMilestone, parseMilestoneQuery } from "@/lib/milestones/engine";
import { composeCreative, resolveCreativeRatio, type CreativeKind } from "@/lib/share/compose";
import { fallbackMonumentImage, renderCreativeImage } from "@/lib/share/render-creative";
import { parseEdition, parsePublicNumber } from "@/lib/utils";

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
    const edition = parseEdition(url.searchParams.get("edition") ?? "");
    const event = edition
      ? await loadSealedEdition(edition).catch(() => getEventSnapshot(eventSlug()))
      : await getEventSnapshot(eventSlug());
    let message;
    if (kind === "message" || kind === "certificate") {
      const n = parsePublicNumber(url.searchParams.get("number") ?? "");
      if (!n) {
        return new Response("Missing number.", { status: 400 });
      }
      if (edition) {
        try {
          message = await loadEditionMessage(edition, n);
        } catch {
          message = await getMessageByNumber(event.id, n);
        }
      } else {
        message = await getMessageByNumber(event.id, n);
      }
    }
    let milestone;
    if (kind === "milestone") {
      const requested = parseMilestoneQuery({
        mark: url.searchParams.get("mark"),
        fire: url.searchParams.get("fire"),
      });
      if (url.searchParams.get("mark") || url.searchParams.get("fire")) {
        if (!requested) {
          return new Response("Unknown milestone.", { status: 400 });
        }
        if (
          !hasReachedMilestone(
            { messages: event.totalMessages, reactions: event.totalReactions },
            requested,
          )
        ) {
          return new Response("Milestone not reached.", { status: 404 });
        }
        milestone = requested;
      }
    }
    const copy = composeCreative({ kind, event, message, milestone });
    const image = renderCreativeImage(copy, ratio);
    const immutableShare = kind === "message" || kind === "certificate";
    image.headers.set(
      "Cache-Control",
      immutableShare
        ? "public, s-maxage=3600, stale-while-revalidate=86400"
        : cacheForPhase(event.phase),
    );
    return image;
  } catch {
    const image: ImageResponse = fallbackMonumentImage(ratio);
    image.headers.set("Cache-Control", "public, s-maxage=30");
    return image;
  }
}
