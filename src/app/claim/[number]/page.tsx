import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClaimForm } from "@/components/claim-form";
import { loadEvent } from "@/lib/data/load";
import { getMessageByNumber } from "@/lib/data/messages";
import { parsePublicNumber, siteUrl } from "@/lib/utils";

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

  return (
    <main className="mx-auto max-w-xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="kicker">Claim</p>
      <h1 className="mt-5 font-display text-[clamp(2.4rem,7vw,4.2rem)] leading-[0.92] text-paper">
        Enter your Wall Key.
      </h1>
      <ClaimForm
        publicNumber={message.publicNumber}
        phase={event.phase}
        finalRank={message.finalRank}
        text={message.isRemoved ? message.text : message.text}
      />
    </main>
  );
}
