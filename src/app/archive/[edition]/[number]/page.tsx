import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SharePanel } from "@/components/share-panel";
import { loadEditionMessage, loadSealedEdition } from "@/lib/data/editions";
import { isSimulation } from "@/lib/env";
import { TAGLINE } from "@/lib/constants";
import { sharePayloadForMessage } from "@/lib/share/copy";
import { publicMessageMetadata } from "@/lib/share/metadata";
import {
  editionMessagePath,
  editionNumberOf,
  editionPath,
  formatCount,
  formatEditionNumber,
  formatPublicNumber,
  formatUtcTime,
  parseEdition,
  parsePublicNumber,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ edition: string; number: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { edition, number } = await params;
  const editionNumber = parseEdition(edition);
  const n = parsePublicNumber(number);
  if (!editionNumber || !n) return { title: "Message", robots: { index: false } };
  try {
    const event = await loadSealedEdition(editionNumber);
    const message = await loadEditionMessage(editionNumber, n);
    return publicMessageMetadata({ event, message });
  } catch {
    return { title: "Message not found", robots: { index: false } };
  }
}

export default async function EditionMessagePage({ params }: Props) {
  if (isSimulation()) await connection();
  const { edition, number } = await params;
  const editionNumber = parseEdition(edition);
  const n = parsePublicNumber(number);
  if (!editionNumber || !n) notFound();

  let event;
  let message;
  try {
    event = await loadSealedEdition(editionNumber);
    message = await loadEditionMessage(editionNumber, n);
  } catch {
    notFound();
  }

  const share = sharePayloadForMessage({
    event,
    message,
    path: editionMessagePath(editionNumber, message.publicNumber),
  });

  return (
    <main className="relative mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
      <p
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-8 font-display text-[clamp(5rem,18vw,11rem)] leading-none text-paper/[0.04] sm:right-6"
      >
        {formatPublicNumber(message.publicNumber)}
      </p>
      <Link href={editionPath(editionNumber)} className="kicker hover:text-paper">
        ← {formatEditionNumber(editionNumberOf(event))}
      </Link>
      <p className="mt-8 font-mono text-sm tracking-[0.22em] text-bronze">
        {formatPublicNumber(message.publicNumber)}
      </p>
      <span className="title-rule mt-5 block" aria-hidden="true" />
      <h1
        className={`mt-6 font-display text-[clamp(2.4rem,7vw,4.8rem)] leading-[1.05] ${message.isRemoved ? "text-ash italic" : "text-paper"}`}
      >
        {message.isRemoved ? message.text : `“${message.text}”`}
      </h1>
      <div className="mt-10 flex flex-wrap items-center gap-6 border-y border-line py-5">
        <p className="font-mono text-sm tracking-[0.12em] text-bronze">
          {formatCount(message.reactionCount)} 🔥
        </p>
        {message.finalRank ? (
          <p className="font-mono text-sm tracking-[0.12em] text-bronze">
            Final rank #{message.finalRank}
          </p>
        ) : null}
        <p className="kicker ml-auto">{TAGLINE}</p>
      </div>
      <dl className="mt-10 grid gap-8 text-sm sm:grid-cols-2">
        <div>
          <dt className="kicker">Edition</dt>
          <dd className="mt-2 text-paper">{formatEditionNumber(editionNumber)}</dd>
        </div>
        <div>
          <dt className="kicker">Published</dt>
          <dd className="mt-2 text-paper">{formatUtcTime(message.publishedAt)}</dd>
        </div>
      </dl>
      <div className="mt-12 flex flex-col gap-4">
        <SharePanel payload={share} via="detail" />
        <p className="break-all font-mono text-xs text-ash">{share.url}</p>
      </div>
    </main>
  );
}
