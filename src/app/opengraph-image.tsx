import { loadEvent } from "@/lib/data/load";
import { composeCreative } from "@/lib/share/compose";
import { fallbackMonumentImage, renderCreativeImage } from "@/lib/share/render-creative";

export const runtime = "nodejs";
export const revalidate = 60;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "THE WALL — one day, one dollar, one sentence forever";

export default async function Image() {
  try {
    const event = await loadEvent();
    return renderCreativeImage(composeCreative({ kind: "countdown", event }), "1200x630");
  } catch {
    return fallbackMonumentImage("1200x630");
  }
}
