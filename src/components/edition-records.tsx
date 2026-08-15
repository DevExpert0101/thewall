import Link from "next/link";
import type { AllTimeRecords, EditionHighlight, EditionRecords } from "@/lib/types";
import {
  editionMessagePath,
  editionPath,
  formatCount,
  formatEditionNumber,
  formatPublicNumber,
} from "@/lib/utils";

function RecordRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="border-t border-line py-5">
      <p className="kicker">{label}</p>
      {href ? (
        <Link href={href} className="mt-2 block font-display text-2xl text-paper hover:text-gold">
          {value}
        </Link>
      ) : (
        <p className="mt-2 font-display text-2xl text-paper">{value}</p>
      )}
    </div>
  );
}

function highlightValue(row: EditionHighlight | null, fallback: string) {
  if (!row) return fallback;
  return formatPublicNumber(row.publicNumber);
}

export function EditionRecordBook({ records }: { records: EditionRecords }) {
  const href = (n: number | undefined) =>
    n ? editionMessagePath(records.editionNumber, n) : undefined;
  return (
    <dl>
      <RecordRow label="First message" value={highlightValue(records.first, "—")} href={href(records.first?.publicNumber)} />
      <RecordRow label="Final message" value={highlightValue(records.last, "—")} href={href(records.last?.publicNumber)} />
      <RecordRow label="Winning message" value={highlightValue(records.winning, "—")} href={href(records.winning?.publicNumber)} />
      <RecordRow
        label="Most reactions"
        value={
          records.mostReacted
            ? `${formatPublicNumber(records.mostReacted.publicNumber)} · ${formatCount(records.mostReacted.reactionCount)} 🔥`
            : "—"
        }
        href={href(records.mostReacted?.publicNumber)}
      />
      {records.milestone100000 ? (
        <RecordRow
          label="100,000th message"
          value={formatPublicNumber(records.milestone100000.publicNumber)}
          href={href(100_000)}
        />
      ) : null}
      {records.milestone250000 ? (
        <RecordRow
          label="250,000th message"
          value={formatPublicNumber(records.milestone250000.publicNumber)}
          href={href(250_000)}
        />
      ) : null}
      <RecordRow label="Total voices" value={formatCount(records.totalMessages)} />
      <RecordRow label="Total reactions" value={`${formatCount(records.totalReactions)} 🔥`} />
      <RecordRow label="Peak messages / minute" value={formatCount(records.peakMessagesPerMinute)} />
      <RecordRow label="Window" value={`${records.durationHours} hours`} />
    </dl>
  );
}

export function AllTimeRecordBook({ records }: { records: AllTimeRecords }) {
  return (
    <dl>
      <RecordRow
        label="Most messages in one Wall"
        value={
          records.mostMessages
            ? `${formatEditionNumber(records.mostMessages.editionNumber)} · ${formatCount(records.mostMessages.totalMessages)}`
            : "—"
        }
        href={records.mostMessages ? editionPath(records.mostMessages.editionNumber) : undefined}
      />
      <RecordRow
        label="Most 🔥 on one message"
        value={
          records.mostFireOnMessage
            ? `${formatEditionNumber(records.mostFireOnMessage.editionNumber)} / ${formatPublicNumber(records.mostFireOnMessage.publicNumber)} · ${formatCount(records.mostFireOnMessage.reactionCount)} 🔥`
            : "—"
        }
        href={
          records.mostFireOnMessage
            ? editionMessagePath(records.mostFireOnMessage.editionNumber, records.mostFireOnMessage.publicNumber)
            : undefined
        }
      />
      <RecordRow
        label="Most reacted Wall"
        value={
          records.mostReactions
            ? `${formatEditionNumber(records.mostReactions.editionNumber)} · ${formatCount(records.mostReactions.totalReactions)} 🔥`
            : "—"
        }
        href={records.mostReactions ? editionPath(records.mostReactions.editionNumber) : undefined}
      />
      <RecordRow
        label="Largest minute"
        value={
          records.largestFinalMinute
            ? `${formatEditionNumber(records.largestFinalMinute.editionNumber)} · ${formatCount(records.largestFinalMinute.peakMessagesPerMinute)} / min`
            : "—"
        }
        href={records.largestFinalMinute ? editionPath(records.largestFinalMinute.editionNumber) : undefined}
      />
    </dl>
  );
}
