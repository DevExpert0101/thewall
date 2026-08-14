import { loadEvent } from "@/lib/data/load";
import { getMessageByNumber } from "@/lib/data/messages";
import { composeCreative } from "@/lib/share/compose";
import { fallbackMonumentImage, renderCreativeImage } from "@/lib/share/render-creative";
import { parsePublicNumber } from "@/lib/utils";

export const runtime = "nodejs";
export const revalidate = 60;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A sentence on THE WALL";

export default async function Image({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const n = parsePublicNumber(number);
  try {
    const event = await loadEvent();
    if (!n) return fallbackMonumentImage("1200x630");
    const message = await getMessageByNumber(event.id, n);
    return renderCreativeImage(composeCreative({ kind: "message", event, message }), "1200x630");
  } catch {
    return fallbackMonumentImage("1200x630");
  }
}
