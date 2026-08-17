import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AllTimeRecordBook } from "@/components/edition-records";
import { loadAllTimeRecords } from "@/lib/data/editions";
import { loadArchiveEditions } from "@/lib/data/load";
import { isSimulation } from "@/lib/env";
import { editionPath, formatWallEdition, siteUrl } from "@/lib/utils";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Records",
  description: "All-time records across sealed Walls. Nothing is invented.",
  alternates: { canonical: `${siteUrl()}/records` },
};

export default async function RecordsPage() {
  if (isSimulation()) await connection();
  const editions = await loadArchiveEditions();
  const records = await loadAllTimeRecords();

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="kicker">Records</p>
      <h1 className="permanence-title mt-5">All-time Wall records.</h1>
      <span className="title-rule mt-6 block" aria-hidden="true" />
      <p className="lede mt-6">
        These numbers come only from sealed Walls. Fire-speed records and
        reaction windows appear only when that Wall kept a complete 🔥 ledger.
        Peak viewers and other unverified counts are omitted.
      </p>
      {editions.length === 0 ? (
        <div className="empty-monument mt-16">
          <p className="font-display text-3xl text-paper sm:text-4xl">No sealed Walls yet.</p>
          <p className="lede mx-auto mt-4 max-w-md">
            Records appear after the first Wall is sealed. The live day is still a
            conversation.
          </p>
          <Link href="/wall" className="btn-ghost mt-10 inline-flex kicker hover:text-paper">
            Return to the live wall →
          </Link>
        </div>
      ) : (
        <div className="mt-12">
          <AllTimeRecordBook records={records} />
          {editions.length > 1 ? (
            <section className="mt-14">
              <p className="kicker text-bronze">Record Books</p>
              <ul className="mt-6">
                {editions.map((edition) => (
                  <li key={edition.id} className="border-t border-line py-4">
                    <Link
                      href={`${editionPath(edition.editionNumber)}/records`}
                      className="font-display text-xl text-paper hover:text-gold"
                    >
                      {formatWallEdition(edition.editionNumber)}
                    </Link>
                    <Link
                      href={editionPath(edition.editionNumber)}
                      className="mt-2 block kicker hover:text-paper"
                    >
                      Open this Wall
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : editions[0] ? (
            <Link
              href={`${editionPath(editions[0].editionNumber)}/records`}
              className="btn-ghost mt-10 inline-flex kicker hover:text-paper"
            >
              {formatWallEdition(editions[0].editionNumber)} Record Book →
            </Link>
          ) : null}
          <Link href="/archive" className="btn-ghost mt-10 inline-flex kicker hover:text-paper">
            Browse the archive →
          </Link>
        </div>
      )}
    </main>
  );
}
