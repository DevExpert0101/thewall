import Link from "next/link";
import { BRAND } from "@/lib/brand";
import {
  formatInscriptionMark,
  formatMonumentEntryMark,
  formatMonumentNumber,
  formatVictorOfWall,
} from "@/lib/monument/format";
import type { MonumentEntry } from "@/lib/monument/types";
import {
  editionMessagePath,
  editionPath,
  formatCount,
  formatPublicDate,
  formatUtcTime,
  formatWallEdition,
} from "@/lib/utils";

export function MonumentEntryView({ entry }: { entry: MonumentEntry }) {
  return (
    <main className="monument-page mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
      <p className="kicker">
        <Link href="/monument" className="hover:text-paper">
          {BRAND.monument}
        </Link>
      </p>
      <p className="mt-8 font-monument text-sm tracking-[0.28em] text-bronze">
        {formatMonumentNumber(entry.monumentNumber)}
      </p>
      <h1 className="permanence-title mt-4">{entry.themeTitle}</h1>
      {entry.themeQuestion ? <p className="lede mt-6 max-w-xl">{entry.themeQuestion}</p> : null}
      <span className="title-rule mt-8 block" aria-hidden="true" />

      <p className="kicker mt-14 text-bronze">{BRAND.victorMark}</p>
      <p className="mt-4 font-mono text-sm tracking-[0.18em] text-mist">
        {formatInscriptionMark(entry.originalPublicNumber)}
      </p>
      <p className={`monument-quote mt-6 ${entry.isRemoved ? "text-ash italic" : "text-paper"}`}>
        {entry.isRemoved ? entry.text : `“${entry.text}”`}
      </p>
      <p className="mt-8 font-mono text-sm tracking-[0.14em] text-bronze">
        {formatCount(entry.finalReactionCount)} 🔥
      </p>
      <p className="monument-meta mt-3">{formatVictorOfWall(entry.editionNumber)}</p>
      <p className="monument-meta mt-6">{formatMonumentEntryMark(entry.monumentNumber)} has been sealed.</p>

      <dl className="mt-16 grid gap-6 text-sm sm:grid-cols-2">
        <Meta label="Wall" value={formatWallEdition(entry.editionNumber)} />
        <Meta label="Inscription" value={formatInscriptionMark(entry.originalPublicNumber)} />
        <Meta label="Sealed" value={formatPublicDate(entry.sealedAt)} />
        <Meta label="Published" value={`${formatPublicDate(entry.publishedAt)} · ${formatUtcTime(entry.publishedAt)}`} />
        <Meta label="Final 🔥" value={formatCount(entry.finalReactionCount)} />
        <Meta label="Winning margin" value={`${formatCount(entry.winningMargin)} 🔥`} />
        <Meta label="Inscriptions" value={formatCount(entry.wallTotalMessages)} />
        <Meta label="Wall fire" value={formatCount(entry.wallTotalReactions)} />
      </dl>
      {entry.archiveHash ? (
        <p className="monument-meta mt-8 break-all">Archive {entry.archiveHash}</p>
      ) : null}

      <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link href={editionPath(entry.editionNumber)} className="btn btn-line">
          View the Wall that created this Victor
        </Link>
        <Link
          href={editionMessagePath(entry.editionNumber, entry.originalPublicNumber)}
          className="btn btn-line"
        >
          View original inscription
        </Link>
      </div>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="kicker text-ash">{label}</dt>
      <dd className="mt-2 text-paper">{value}</dd>
    </div>
  );
}
