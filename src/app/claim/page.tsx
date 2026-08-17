import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ClaimForm } from "@/components/claim-form";
import { WinnerAnnouncement } from "@/components/winner-announcement";
import { loadEvent, loadLatestPublicWinner } from "@/lib/data/load";
import { isSimulation } from "@/lib/env";
import { loadMonumentForEdition } from "@/lib/monument/store";
import { siteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Claim",
  robots: { index: false, follow: false },
  alternates: { canonical: `${siteUrl()}/claim` },
};

export default async function ClaimIndexPage() {
  if (isSimulation()) await connection();
  const event = await loadEvent();
  const winner = await loadLatestPublicWinner();
  const monument = winner ? await loadMonumentForEdition(winner.editionNumber).catch(() => null) : null;

  return (
    <main className="mx-auto max-w-xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="kicker">Claim</p>
      <h1 className="permanence-title mt-5">
        {winner ? "A sealed sentence won." : "No winner is public yet."}
      </h1>
      <span className="title-rule mt-6 block" aria-hidden="true" />
      <p className="lede mt-6">
        {winner
          ? "The public record is the Wall, the number, the sentence, and the final 🔥. Ownership stays private."
          : event.phase === "finalizing"
            ? "This Wall is under review. The winner is announced only after the day is finished."
            : event.phase === "archived"
              ? "No winning message is recorded for the latest sealed Wall."
              : "A winner is announced only after this Wall is sealed. Come back with your Wall Key then."}
      </p>

      {winner ? (
        <div className="mt-12">
          <WinnerAnnouncement
            winner={winner}
            href={`/claim/${winner.publicNumber}`}
            monumentNumber={monument?.monumentNumber}
          />
          <ClaimForm
            publicNumber={winner.publicNumber}
            phase="archived"
            finalRank={1}
            text={winner.text}
            editionNumber={winner.editionNumber}
            monument={monument}
          />
        </div>
      ) : (
        <p className="mt-10">
          <Link href="/wall" className="kicker hover:text-paper">
            Return to the Wall →
          </Link>
        </p>
      )}
    </main>
  );
}
