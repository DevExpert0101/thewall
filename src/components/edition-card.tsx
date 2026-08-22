import Link from "next/link";
import type { EditionSummary } from "@/lib/types";
import { formatMonumentNumber } from "@/lib/monument/format";
import { editionPath, formatCount, formatEditionMonth, formatEditionNumber, formatWallEdition, monumentPath } from "@/lib/utils";

export function EditionCard({ edition }: { edition: EditionSummary }) {
  const href = editionPath(edition.editionNumber);
  const excerpt = edition.winning?.isRemoved
    ? edition.winning.text
    : edition.winning
      ? `“${edition.winning.text}”`
      : null;
  return (
    <article className="edition-plaque">
      <p className="edition-numeral" aria-hidden="true">
        {formatEditionNumber(edition.editionNumber)}
      </p>
      <Link href={href} className="relative block">
        <p className="edition-mark">
          {formatWallEdition(edition.editionNumber)}
        </p>
        {edition.title && edition.title !== "THE WALL" ? (
          <p className="mt-2 font-display text-xl text-paper">{edition.title}</p>
        ) : null}
        <p className="edition-month">
          {formatEditionMonth(edition.startsAt)}
        </p>
        <p className="edition-count">
          {formatCount(edition.totalMessages)} inscriptions
        </p>
        <p className="edition-fire">
          {formatCount(edition.totalReactions)} 🔥
        </p>
        {excerpt ? (
          <p className="mt-4 font-display text-lg leading-snug text-paper">{excerpt}</p>
        ) : null}
        {edition.monumentNumber ? (
          <p className="edition-state">{formatMonumentNumber(edition.monumentNumber)}</p>
        ) : (
          <p className="edition-state">Sealed</p>
        )}
      </Link>
      {edition.monumentNumber ? (
        <Link href={monumentPath(edition.monumentNumber)} className="btn-ghost mt-4 inline-flex kicker hover:text-paper">
          {formatMonumentNumber(edition.monumentNumber)} →
        </Link>
      ) : null}
    </article>
  );
}
