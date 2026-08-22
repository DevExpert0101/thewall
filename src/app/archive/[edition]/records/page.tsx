import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EditionRecordBook } from "@/components/edition-records";
import { loadEditionRecords, loadSealedEdition } from "@/lib/data/editions";
import { isSimulation } from "@/lib/env";
import {
  editionPath,
  formatEditionDate,
  formatEditionNumber,
  parseEdition,
  wallTitle,
} from "@/lib/utils";

export const revalidate = 3600;

type Props = { params: Promise<{ edition: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const editionNumber = parseEdition((await params).edition);
  if (!editionNumber) return { title: "Records", robots: { index: false } };
  return {
    title: `${formatEditionNumber(editionNumber)} — Record Book`,
    alternates: { canonical: `${editionPath(editionNumber)}/records` },
  };
}

export default async function EditionRecordsPage({ params }: Props) {
  if (isSimulation()) await connection();
  const editionNumber = parseEdition((await params).edition);
  if (!editionNumber) notFound();

  let event;
  try {
    event = await loadSealedEdition(editionNumber);
  } catch {
    notFound();
  }

  const records = await loadEditionRecords(event);

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="kicker">
        <Link href={editionPath(editionNumber)} className="hover:text-paper">
          ← {formatEditionNumber(editionNumber)}
        </Link>
      </p>
      <p className="mt-3 font-mono text-xs tracking-[0.18em] text-bronze">Record Book · Archive</p>
      <h1 className="permanence-title mt-5">
        {wallTitle(event)}
      </h1>
      <span className="title-rule mt-6 block" aria-hidden="true" />
      <p className="lede mt-6">
        {formatEditionNumber(editionNumber)} · {formatEditionDate(event.startsAt)}. Only
        statistics this Wall can prove. Nothing is invented after the fact.
      </p>
      <div className="mt-12">
        <EditionRecordBook records={records} />
      </div>
      <p className="mt-12">
        <Link href="/records" className="kicker hover:text-paper">
          All-time records →
        </Link>
      </p>
    </main>
  );
}
