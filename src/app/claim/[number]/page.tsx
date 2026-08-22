import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClaimForm } from "@/components/claim-form";
import { WinnerAnnouncement } from "@/components/winner-announcement";
import { loadEvent } from "@/lib/data/load";
import { getMessageByNumber } from "@/lib/data/messages";
import { loadMonumentForEdition } from "@/lib/monument/store";
import { publicWinnerFrom } from "@/lib/ownership/winner";
import { editionNumberOf, parsePublicNumber, siteUrl } from "@/lib/utils";

export const revalidate = 5;

type Props = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { number } = await params;
  return {
    title: `Claim ${number}`,
    robots: { index: false, follow: false },
    alternates: { canonical: `${siteUrl()}/claim/${number}` },
  };
}

export default async function ClaimPage({ params }: Props) {
  const { number } = await params;
  const n = parsePublicNumber(number);
  if (!n) notFound();
  const event = await loadEvent();
  let message;
  try {
    message = await getMessageByNumber(event.id, n);
  } catch {
    notFound();
  }

  const edition = editionNumberOf(event);
  const monument = await loadMonumentForEdition(edition).catch(() => null);
  const winner =
    event.phase === "archived" && message.finalRank === 1
      ? publicWinnerFrom(edition, {
          publicNumber: message.publicNumber,
          text: message.text,
          isRemoved: message.isRemoved,
          reactionCount: message.reactionCount,
          finalRank: message.finalRank,
          publishedAt: message.publishedAt,
        })
      : null;

  return (
    <main className="mx-auto max-w-xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="kicker">Claim</p>
      <h1 className="mt-5 font-display text-[clamp(2.4rem,7vw,4.2rem)] leading-[0.92] text-paper">
        Enter your Wall Key.
      </h1>
      {winner ? (
        <div className="mt-10">
          <WinnerAnnouncement winner={winner} monumentNumber={monument?.monumentNumber} />
        </div>
      ) : null}
      <ClaimForm
        publicNumber={message.publicNumber}
        phase={event.phase}
        finalRank={message.finalRank}
        text={message.text}
        editionNumber={edition}
        monument={winner ? monument : null}
      />
    </main>
  );
}
