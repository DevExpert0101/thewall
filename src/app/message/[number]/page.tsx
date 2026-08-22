import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageExhibit } from "@/components/message-exhibit";
import { OwnedMark } from "@/components/owned-mark";
import { ReportMessage } from "@/components/report-message";
import { SharePanel } from "@/components/share-panel";
import { VisitLoop } from "@/components/visit-loop";
import { loadEvent } from "@/lib/data/load";
import { publicMessageForPhase, publicPhaseLabel } from "@/lib/event/state";
import { getMessageByNumber } from "@/lib/data/messages";
import { sharePayloadForMessage } from "@/lib/share/copy";
import { publicMessageMetadata } from "@/lib/share/metadata";
import { editionNumberOf, editionPath, formatCount, formatObjectIdentity, formatPublicNumber, formatUtcDate, formatUtcTime, parsePublicNumber } from "@/lib/utils";

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
    const message = publicMessageForPhase(await getMessageByNumber(event.id, n), event.phase);
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
    message = publicMessageForPhase(await getMessageByNumber(event.id, n), event.phase);
  } catch {
    notFound();
  }

  const share = sharePayloadForMessage({ event, message });

  return (
    <main className="message-page relative mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
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
        editionNumber={editionNumberOf(event)}
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
      <MessageExhibit event={event} message={message} />
      <dl className="mt-12 grid gap-8 text-sm sm:grid-cols-2">
        <Meta label="Message" value={formatObjectIdentity(message.publicNumber, editionNumberOf(event))} />
        <Meta label="Date" value={formatUtcDate(event.startsAt)} />
        <Meta label="Wall status" value={publicPhaseLabel(event.phase)} />
        <Meta label="Published" value={formatUtcTime(message.publishedAt)} />
        <Meta label="Reactions" value={`${formatCount(message.reactionCount)} 🔥`} />
      </dl>
      <div className="mt-12 flex flex-col gap-4">
        <SharePanel payload={share} via="detail" preview />
        <p className="break-all font-mono text-xs text-ash">{share.url}</p>
        <VisitLoop
          phase={event.phase}
          endsAt={event.endsAt}
          serverNow={event.serverNow}
          editionNumber={editionNumberOf(event)}
        />
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
