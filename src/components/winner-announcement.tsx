import Link from "next/link";
import { SharePanel } from "@/components/share-panel";
import type { PublicWinner } from "@/lib/ownership/winner";
import { sharePayloadForWinner } from "@/lib/share/copy";
import { formatMonumentNumber } from "@/lib/monument/format";
import { editionPath, formatCount, formatMessageMark, formatWallEdition, monumentPath } from "@/lib/utils";

export function WinnerAnnouncement({
  winner,
  href,
  monumentNumber,
}: {
  winner: PublicWinner;
  href?: string;
  monumentNumber?: number | null;
}) {
  return (
    <section className="archive-exhibit p-7 sm:p-10">
      <p className="kicker text-bronze">The Victor</p>
      <p className="mt-5 font-mono text-sm tracking-[0.22em] text-bronze">
        {formatWallEdition(winner.editionNumber)}
      </p>
      <p className="mt-3 font-mono text-sm tracking-[0.18em] text-mist">
        {formatMessageMark(winner.publicNumber)}
      </p>
      <p className={`mt-6 font-display text-3xl leading-snug sm:text-4xl ${winner.isRemoved ? "text-ash italic" : "text-paper"}`}>
        {winner.isRemoved ? winner.text : `“${winner.text}”`}
      </p>
      <p className="mt-8 font-mono text-sm tracking-[0.14em] text-mist">
        {formatCount(winner.reactionCount)} 🔥
      </p>
      {href ? (
        <Link href={href} className="btn-ghost mt-6 inline-flex kicker hover:text-paper">
          {formatMessageMark(winner.publicNumber)} →
        </Link>
      ) : (
        <Link
          href={editionPath(winner.editionNumber)}
          className="btn-ghost mt-6 inline-flex kicker hover:text-paper"
        >
          Open this Wall →
        </Link>
      )}
      {monumentNumber ? (
        <Link
          href={monumentPath(monumentNumber)}
          className="btn-ghost mt-3 inline-flex kicker hover:text-paper"
        >
          {formatMonumentNumber(monumentNumber)} →
        </Link>
      ) : null}
      {!winner.isRemoved ? (
        <div className="mt-8 border-t border-line pt-6">
          <SharePanel
            payload={sharePayloadForWinner(winner)}
            via="detail"
            primaryLabel="Share this sentence"
            preview
          />
        </div>
      ) : null}
    </section>
  );
}
