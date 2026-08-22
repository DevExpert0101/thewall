import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArchiveVerifyView } from "@/components/archive-verify";
import { fingerprintsMatch } from "@/lib/archive/verify";
import { loadCanonicalArchive, loadSealedEdition } from "@/lib/data/editions";
import { isSimulation } from "@/lib/env";
import { publicPageMetadata } from "@/lib/share/metadata";
import {
  editionNumberOf,
  editionPath,
  editionVerifyPath,
  formatWallEdition,
  parseEdition,
  wallTitle,
} from "@/lib/utils";

export const revalidate = 3600;

type Props = { params: Promise<{ edition: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const editionNumber = parseEdition((await params).edition);
  if (!editionNumber) return { title: "Verification", robots: { index: false } };
  try {
    const event = await loadSealedEdition(editionNumber);
    return publicPageMetadata({
      event,
      path: editionVerifyPath(editionNumber),
      kind: "milestone",
    });
  } catch {
    return { title: "Edition not found", robots: { index: false } };
  }
}

export default async function EditionVerifyPage({ params }: Props) {
  if (isSimulation()) await connection();
  const editionNumber = parseEdition((await params).edition);
  if (!editionNumber) notFound();

  let event;
  try {
    event = await loadSealedEdition(editionNumber);
  } catch {
    notFound();
  }

  const sealed = await loadCanonicalArchive(event).catch(() => null);
  const storedHash = event.archiveHash ?? null;
  const storedRoot = event.merkleRoot ?? null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
      <p className="kicker">
        <Link href={editionPath(editionNumber)} className="hover:text-paper">
          ← {formatWallEdition(editionNumberOf(event))}
        </Link>
        {isSimulation() ? " · Simulation" : ""}
      </p>
      <div className="mt-10">
        <ArchiveVerifyView
          editionNumber={editionNumberOf(event)}
          title={wallTitle(event)}
          totalMessages={event.totalMessages}
          finalizedAt={event.finalizedAt ?? event.archivedAt ?? event.endsAt}
          archiveHash={storedHash}
          merkleRoot={storedRoot}
          matches={
            Boolean(storedHash && storedRoot) &&
            fingerprintsMatch(storedHash, sealed?.archiveHash) &&
            fingerprintsMatch(storedRoot, sealed?.merkleRoot)
          }
          archiveUri={event.archiveUri}
          proofRef={event.proofTx}
        />
      </div>
    </main>
  );
}
