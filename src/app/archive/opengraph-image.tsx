import { loadEvent } from "@/lib/data/load";
import { composeCreative } from "@/lib/share/compose";
import { fallbackMonumentImage, renderCreativeImage } from "@/lib/share/render-creative";

export const runtime = "nodejs";
export const revalidate = 300;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "THE WALL — archive";

export default async function Image() {
  try {
    const event = await loadEvent();
    const kind = event.phase === "archived" ? "milestone" : "countdown";
    return renderCreativeImage(composeCreative({ kind, event }), "1200x630");
  } catch {
    return fallbackMonumentImage("1200x630");
  }
}
