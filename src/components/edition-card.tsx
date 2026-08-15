import Link from "next/link";
import type { EditionSummary } from "@/lib/types";
import { editionPath, formatCount, formatEditionDate, formatEditionNumber, formatPublicNumber, wallTitle } from "@/lib/utils";

export function EditionCard({ edition }: { edition: EditionSummary }) {
  const href = editionPath(edition.editionNumber);
  return (
    <article className="inscribe p-5 sm:p-6">
      <p className="kicker text-bronze">{formatEditionNumber(edition.editionNumber)}</p>
      <h2 className="mt-3 font-display text-3xl leading-tight text-paper sm:text-4xl">
        <Link href={href} className="hover:text-gold">
          {wallTitle(edition)}
        </Link>
      </h2>
      <p className="mt-2 font-mono text-xs tracking-[0.14em] text-mist">
        {formatEditionDate(edition.startsAt)}
      </p>
      <p className="mt-4 font-mono text-xs tracking-[0.14em] text-mist">
        {formatCount(edition.totalMessages)} voices · {formatCount(edition.totalReactions)} 🔥
      </p>
      {edition.winning ? (
        <p className="mt-5 font-display text-xl leading-snug text-paper">
          {edition.winning.isRemoved
            ? edition.winning.text
            : `“${edition.winning.text}”`}
          <span className="mt-2 block font-mono text-xs tracking-[0.14em] text-bronze">
            Winning {formatPublicNumber(edition.winning.publicNumber)}
          </span>
        </p>
      ) : null}
      <Link href={href} className="btn-ghost mt-6 inline-flex kicker hover:text-paper">
        Open this edition →
      </Link>
    </article>
  );
}
