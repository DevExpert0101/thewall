import { loadEvent } from "@/lib/data/load";
import { getMessageByNumber } from "@/lib/data/messages";
import { ogCopyForEvent, ogCopyForMessage } from "@/lib/share/copy";
import { creativeImageUrl, parseShareableUrl } from "@/lib/share/links";
import { APP_NAME } from "@/lib/constants";
import { parsePublicNumber, siteUrl } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const format = requestUrl.searchParams.get("format") ?? "json";
  if (format !== "json") {
    return new Response("Only JSON oEmbed is supported.", { status: 501 });
  }
  const raw = requestUrl.searchParams.get("url");
  if (!raw) {
    return Response.json({ error: "Missing url." }, { status: 400 });
  }
  const target = parseShareableUrl(raw);
  if (!target) {
    return Response.json({ error: "URL is not a public Wall page." }, { status: 404 });
  }

  const path = target.pathname.replace(/\/$/, "") || "/";
  const origin = siteUrl();
  let title = APP_NAME;
  let description = "";
  let thumbnail = creativeImageUrl({ kind: "countdown", ratio: "1200x630", origin });

  try {
    const event = await loadEvent();
    const messageMatch = path.match(/^\/(?:message|archive\/\d{1,6})\/(\d{1,8})$/);
    if (messageMatch) {
      const n = parsePublicNumber(messageMatch[1] ?? "");
      if (n) {
        const message = await getMessageByNumber(event.id, n);
        const copy = ogCopyForMessage({ event, message });
        title = copy.title;
        description = copy.description;
        thumbnail = creativeImageUrl({
          kind: "message",
          ratio: "1200x630",
          number: n,
          origin,
        });
      }
    } else {
      const copy = ogCopyForEvent(event);
      title = copy.title;
      description = copy.description;
      thumbnail = creativeImageUrl({
        kind: path === "/archive" ? "milestone" : "countdown",
        ratio: "1200x630",
        origin,
      });
    }
  } catch {
    title = APP_NAME;
  }

  return Response.json(
    {
      version: "1.0",
      type: "link",
      provider_name: APP_NAME,
      provider_url: origin,
      title,
      description,
      url: target.toString(),
      thumbnail_url: thumbnail,
      thumbnail_width: 1200,
      thumbnail_height: 630,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
      },
    },
  );
}
