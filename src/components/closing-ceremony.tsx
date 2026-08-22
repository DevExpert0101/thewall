import Link from "next/link";
import { BRAND } from "@/lib/brand";
import {
  formatInscriptionMark,
  formatMonumentEntryMark,
  formatMonumentNumber,
} from "@/lib/monument/format";
import type { MonumentEntry } from "@/lib/monument/types";
import { formatCount, monumentPath, wallTitle } from "@/lib/utils";

export function ClosingCeremony({
  entry,
  reviewing = false,
}: {
  entry?: MonumentEntry | null;
  reviewing?: boolean;
}) {
  if (reviewing && !entry) {
    return (
      <section className="ceremony-stage my-8">
        <p className="kicker">{BRAND.closedMark}</p>
        <p className="mt-4 text-sm text-mist">The day is under review. The Victor is not public yet.</p>
      </section>
    );
  }
  if (!entry) return null;

  return (
    <section className="ceremony-stage my-10">
      <p className="kicker">{BRAND.closedMark}</p>
      <p className="kicker mt-10 text-bronze">{BRAND.victorMark}</p>
      <p className="mt-4 font-mono text-sm tracking-[0.18em] text-mist">
        {formatInscriptionMark(entry.originalPublicNumber)}
      </p>
      <p className={`monument-quote mx-auto mt-5 max-w-2xl ${entry.isRemoved ? "text-ash italic" : "text-paper"}`}>
        {entry.isRemoved ? entry.text : `“${entry.text}”`}
      </p>
      <p className="mt-6 font-mono text-sm tracking-[0.14em] text-bronze">
        {formatCount(entry.finalReactionCount)} 🔥
      </p>
      <p className="mt-3 text-sm text-mist">Winner of {wallTitle({ title: entry.themeTitle })}</p>
      <p className="kicker mt-10">Promoting the Victor to The Monument</p>
      <p className="mt-4 font-monument text-sm tracking-[0.2em] text-bronze">
        {formatMonumentEntryMark(entry.monumentNumber)} HAS BEEN SEALED.
      </p>
      <Link href={monumentPath(entry.monumentNumber)} className="btn btn-primary mt-8">
        {formatMonumentNumber(entry.monumentNumber)}
      </Link>
    </section>
  );
}
