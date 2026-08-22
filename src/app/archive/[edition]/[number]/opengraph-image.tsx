import { loadEditionMessage, loadSealedEdition } from "@/lib/data/editions";
import { composeCreative } from "@/lib/share/compose";
import { fallbackMonumentImage, renderCreativeImage } from "@/lib/share/render-creative";
import { parseEdition, parsePublicNumber } from "@/lib/utils";

export const runtime = "nodejs";
export const revalidate = 3600;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A sentence on THE WALL";

export default async function Image({
  params,
}: {
  params: Promise<{ edition: string; number: string }>;
}) {
  const { edition, number } = await params;
  const editionNumber = parseEdition(edition);
  const n = parsePublicNumber(number);
  try {
    if (!editionNumber || !n) return fallbackMonumentImage("1200x630");
    const event = await loadSealedEdition(editionNumber);
    const message = await loadEditionMessage(editionNumber, n);
    return renderCreativeImage(composeCreative({ kind: "message", event, message }), "1200x630");
  } catch {
    return fallbackMonumentImage("1200x630");
  }
}
