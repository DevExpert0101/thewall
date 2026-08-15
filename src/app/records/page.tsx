import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AllTimeRecordBook } from "@/components/edition-records";
import { loadAllTimeRecords } from "@/lib/data/editions";
import { loadArchiveEditions } from "@/lib/data/load";
import { isSimulation } from "@/lib/env";
import { siteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Records",
  description: "All-time records across sealed Wall editions. Nothing is invented.",
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
        These numbers come only from sealed editions. Peak viewers and unverified
        milestones are omitted.
      </p>
      {editions.length === 0 ? (
        <div className="empty-monument mt-16">
          <p className="font-display text-3xl text-paper sm:text-4xl">No editions yet.</p>
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
          <Link href="/archive" className="btn-ghost mt-10 inline-flex kicker hover:text-paper">
            Browse the archive →
          </Link>
        </div>
      )}
    </main>
  );
}
