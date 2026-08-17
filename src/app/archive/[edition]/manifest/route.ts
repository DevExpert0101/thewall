import { buildArchiveManifest, serializeArchiveManifest } from "@/lib/archive/manifest";
import { loadCanonicalArchive, loadSealedEdition } from "@/lib/data/editions";
import { jsonError } from "@/lib/http";
import { parseEdition } from "@/lib/utils";

export const revalidate = 3600;

type Props = { params: Promise<{ edition: string }> };

export async function GET(_request: Request, { params }: Props) {
  try {
    const editionNumber = parseEdition((await params).edition);
    if (!editionNumber) {
      return new Response("Edition not found.", { status: 404 });
    }
    const event = await loadSealedEdition(editionNumber);
    const archive = await loadCanonicalArchive(event);
    const manifest = buildArchiveManifest({
      archive,
      replicaUri: event.archiveUri,
      proofRef: event.proofTx,
    });
    const pad = String(editionNumber).padStart(3, "0");
    return new Response(serializeArchiveManifest(manifest), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="the-wall-${pad}.manifest.json"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
