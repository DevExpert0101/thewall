import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FireButton } from "@/components/fire-button";
import { OwnedMark } from "@/components/owned-mark";
import { ReportMessage } from "@/components/report-message";
import { SharePanel } from "@/components/share-panel";
import { loadEvent } from "@/lib/data/load";
import { getMessageByNumber } from "@/lib/data/messages";
import { TAGLINE } from "@/lib/constants";
import { sharePayloadForMessage } from "@/lib/share/copy";
import { publicMessageMetadata } from "@/lib/share/metadata";
import { editionNumberOf, editionPath, formatCount, formatPublicNumber, formatUtcDate, formatUtcTime, parsePublicNumber } from "@/lib/utils";

export const revalidate = 5;

type Props = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { number } = await params;
  const n = parsePublicNumber(number);
  if (!n) {
    return { title: "Message", robots: { index: false } };
  }
  try {
    const event = await loadEvent();
    const message = await getMessageByNumber(event.id, n);
    return publicMessageMetadata({ event, message });
  } catch {
    return { title: "Message not found", robots: { index: false } };
  }
}

export default async function MessagePage({ params }: Props) {
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

  const share = sharePayloadForMessage({ event, message });

  return (
    <main className="relative mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
      <p
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-8 font-display text-[clamp(5rem,18vw,11rem)] leading-none text-paper/[0.04] sm:right-6"
      >
        {formatPublicNumber(message.publicNumber)}
      </p>
      <OwnedMark
        publicNumber={message.publicNumber}
        reactionCount={message.reactionCount}
        finalRank={message.finalRank}
      />
      <Link
        href={
          event.phase === "live" || event.phase === "upcoming"
            ? "/wall"
            : editionPath(editionNumberOf(event))
        }
        className="kicker hover:text-paper"
      >
        {event.phase === "live" || event.phase === "upcoming" ? "← The Wall" : "← Archive"}
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
        <FireButton
          messageId={message.id}
          count={message.reactionCount}
          disabled={event.phase !== "live" || message.isRemoved}
        />
        {message.finalRank ? (
          <p className="font-mono text-sm tracking-[0.12em] text-bronze">
            Final rank #{message.finalRank}
          </p>
        ) : null}
        <p className="kicker ml-auto">{TAGLINE}</p>
      </div>
      <dl className="mt-10 grid gap-8 text-sm sm:grid-cols-2">
        <Meta label="Event" value={formatUtcDate(event.startsAt)} />
        <Meta label="Wall status" value={event.phase === "archived" ? "frozen" : event.phase} />
        <Meta label="Published" value={formatUtcTime(message.publishedAt)} />
        <Meta label="Reactions" value={`${formatCount(message.reactionCount)} 🔥`} />
      </dl>
      <div className="mt-12 flex flex-col gap-4">
        <SharePanel payload={share} via="detail" />
        <p className="break-all font-mono text-xs text-ash">{share.url}</p>
        {!message.isRemoved ? <ReportMessage messageId={message.id} /> : null}
      </div>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="kicker">{label}</dt>
      <dd className="mt-2 text-paper">{value}</dd>
    </div>
  );
}
