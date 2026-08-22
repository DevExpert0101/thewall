import Link from "next/link";
import { formatElapsed } from "@/lib/archive/records";
import { milestoneChorus, milestoneHeadline } from "@/lib/milestones/engine";
import type { AllTimeRecords, EditionHighlight, EditionRecords, FirePaceRecord } from "@/lib/types";
import {
  editionMessagePath,
  editionPath,
  formatCount,
  formatEditionNumber,
  formatMessageMark,
  formatPublicNumber,
  formatWallEdition,
} from "@/lib/utils";

function RecordRow({
  label,
  value,
  href,
  wallHref,
  wallLabel,
  quote,
}: {
  label: string;
  value: string;
  href?: string;
  wallHref?: string;
  wallLabel?: string;
  quote?: string | null;
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
      {quote ? <p className="mt-3 max-w-2xl font-display text-lg leading-snug text-mist">“{quote}”</p> : null}
      {wallHref ? (
        <Link href={wallHref} className="mt-2 inline-flex kicker hover:text-paper">
          {wallLabel ?? "Open this Wall"}
        </Link>
      ) : null}
    </div>
  );
}

function highlightValue(row: EditionHighlight | null, fallback: string) {
  if (!row) return fallback;
  return formatMessageMark(row.publicNumber);
}

function paceValue(row: FirePaceRecord): string {
  return `${formatMessageMark(row.publicNumber)} · ${formatElapsed(row.elapsedMs)}`;
}

export function EditionRecordBook({ records }: { records: EditionRecords }) {
  const wall = editionPath(records.editionNumber);
  const wallLabel = formatWallEdition(records.editionNumber);
  const href = (n: number | undefined) =>
    n ? editionMessagePath(records.editionNumber, n) : undefined;

  return (
    <div>
      <dl>
        <RecordRow
          label="First message"
          value={highlightValue(records.first, "—")}
          href={href(records.first?.publicNumber)}
          wallHref={records.first ? wall : undefined}
          wallLabel={wallLabel}
          quote={records.first && !records.first.isRemoved ? records.first.text : null}
        />
        <RecordRow
          label="Final message"
          value={highlightValue(records.last, "—")}
          href={href(records.last?.publicNumber)}
          wallHref={records.last ? wall : undefined}
          wallLabel={wallLabel}
          quote={records.last && !records.last.isRemoved ? records.last.text : null}
        />
        <RecordRow
          label="Winning Message"
          value={highlightValue(records.winning, "—")}
          href={href(records.winning?.publicNumber)}
          wallHref={records.winning ? wall : undefined}
          wallLabel={wallLabel}
          quote={records.winning && !records.winning.isRemoved ? records.winning.text : null}
        />
        <RecordRow
          label="Most reacted"
          value={
            records.mostReacted
              ? `${formatMessageMark(records.mostReacted.publicNumber)} · ${formatCount(records.mostReacted.reactionCount)} 🔥`
              : "—"
          }
          href={href(records.mostReacted?.publicNumber)}
          wallHref={records.mostReacted ? wall : undefined}
          wallLabel={wallLabel}
          quote={records.mostReacted && !records.mostReacted.isRemoved ? records.mostReacted.text : null}
        />
        {records.fastestTo100 ? (
          <RecordRow
            label="Fastest to 100 🔥"
            value={paceValue(records.fastestTo100)}
            href={href(records.fastestTo100.publicNumber)}
            wallHref={wall}
            wallLabel={wallLabel}
          />
        ) : null}
        {records.fastestTo1000 ? (
          <RecordRow
            label="Fastest to 1,000 🔥"
            value={paceValue(records.fastestTo1000)}
            href={href(records.fastestTo1000.publicNumber)}
            wallHref={wall}
            wallLabel={wallLabel}
          />
        ) : null}
        {records.fastestTo10000 ? (
          <RecordRow
            label="Fastest to 10,000 🔥"
            value={paceValue(records.fastestTo10000)}
            href={href(records.fastestTo10000.publicNumber)}
            wallHref={wall}
            wallLabel={wallLabel}
          />
        ) : null}
        {records.mostReactionsInOneHour != null ? (
          <RecordRow
            label="Most reactions in one hour"
            value={`${formatCount(records.mostReactionsInOneHour)} 🔥`}
            wallHref={wall}
            wallLabel={wallLabel}
          />
        ) : null}
        <RecordRow
          label="Voices"
          value={formatCount(records.totalMessages)}
          wallHref={wall}
          wallLabel={wallLabel}
        />
        <RecordRow
          label="Fire"
          value={`${formatCount(records.totalReactions)} 🔥`}
          wallHref={wall}
          wallLabel={wallLabel}
        />
        <RecordRow
          label="Peak messages / minute"
          value={formatCount(records.peakMessagesPerMinute)}
          wallHref={wall}
          wallLabel={wallLabel}
        />
        {records.peakReactionsPerMinute != null ? (
          <RecordRow
            label="Peak reactions / minute"
            value={`${formatCount(records.peakReactionsPerMinute)} 🔥`}
            wallHref={wall}
            wallLabel={wallLabel}
          />
        ) : null}
        {records.milestones.map((mark) => (
          <RecordRow
            key={`${mark.kind}:${mark.value}`}
            label={milestoneChorus({
              id: `${mark.kind}:${mark.value}`,
              kind: mark.kind,
              value: mark.value,
              celebrate: false,
            })}
            value={milestoneHeadline({
              id: `${mark.kind}:${mark.value}`,
              kind: mark.kind,
              value: mark.value,
              celebrate: false,
            })}
            href={mark.publicNumber ? href(mark.publicNumber) : undefined}
            wallHref={wall}
            wallLabel={wallLabel}
          />
        ))}
        <RecordRow label="Window" value={`${records.durationHours} hours`} wallHref={wall} wallLabel={wallLabel} />
      </dl>
      {!records.fireLedgerComplete ? (
        <p className="mt-8 text-sm leading-relaxed text-ash">
          Fastest-to-🔥 and peak reaction windows are omitted. Those records need a complete
          reaction ledger, and this Wall does not have one.
        </p>
      ) : null}
      {records.top100.length > 0 ? (
        <section className="mt-14">
          <p className="kicker text-bronze">
            {records.top100.length >= 100 ? "Final Top 100" : "Final ranking"}
          </p>
          <ol className="mt-6">
            {records.top100.map((row) => (
              <li key={row.publicNumber} className="border-t border-line py-4">
                <p className="kicker">Rank #{row.finalRank}</p>
                <Link
                  href={editionMessagePath(records.editionNumber, row.publicNumber)}
                  className="mt-2 block font-display text-xl text-paper hover:text-gold"
                >
                  {formatMessageMark(row.publicNumber)}
                  {row.reactionCount ? ` · ${formatCount(row.reactionCount)} 🔥` : ""}
                </Link>
                <Link href={wall} className="mt-2 inline-flex kicker hover:text-paper">
                  {wallLabel}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

export function AllTimeRecordBook({ records }: { records: AllTimeRecords }) {
  const wall = (n: number) => editionPath(n);
  const message = (edition: number, n: number) => editionMessagePath(edition, n);
  const label = (n: number) => formatWallEdition(n);

  return (
    <dl>
      <RecordRow
        label="Most messages in one Wall"
        value={
          records.mostMessages
            ? `${formatEditionNumber(records.mostMessages.editionNumber)} · ${formatCount(records.mostMessages.totalMessages)}`
            : "—"
        }
        href={records.mostMessages ? wall(records.mostMessages.editionNumber) : undefined}
        wallHref={records.mostMessages ? wall(records.mostMessages.editionNumber) : undefined}
        wallLabel={records.mostMessages ? label(records.mostMessages.editionNumber) : undefined}
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
            ? message(records.mostFireOnMessage.editionNumber, records.mostFireOnMessage.publicNumber)
            : undefined
        }
        wallHref={records.mostFireOnMessage ? wall(records.mostFireOnMessage.editionNumber) : undefined}
        wallLabel={records.mostFireOnMessage ? label(records.mostFireOnMessage.editionNumber) : undefined}
      />
      <RecordRow
        label="Most reacted Wall"
        value={
          records.mostReactions
            ? `${formatEditionNumber(records.mostReactions.editionNumber)} · ${formatCount(records.mostReactions.totalReactions)} 🔥`
            : "—"
        }
        href={records.mostReactions ? wall(records.mostReactions.editionNumber) : undefined}
        wallHref={records.mostReactions ? wall(records.mostReactions.editionNumber) : undefined}
        wallLabel={records.mostReactions ? label(records.mostReactions.editionNumber) : undefined}
      />
      {records.fastestTo100 ? (
        <RecordRow
          label="Fastest to 100 🔥"
          value={`${formatEditionNumber(records.fastestTo100.editionNumber)} / ${paceValue(records.fastestTo100)}`}
          href={message(records.fastestTo100.editionNumber, records.fastestTo100.publicNumber)}
          wallHref={wall(records.fastestTo100.editionNumber)}
          wallLabel={label(records.fastestTo100.editionNumber)}
        />
      ) : null}
      {records.fastestTo1000 ? (
        <RecordRow
          label="Fastest to 1,000 🔥"
          value={`${formatEditionNumber(records.fastestTo1000.editionNumber)} / ${paceValue(records.fastestTo1000)}`}
          href={message(records.fastestTo1000.editionNumber, records.fastestTo1000.publicNumber)}
          wallHref={wall(records.fastestTo1000.editionNumber)}
          wallLabel={label(records.fastestTo1000.editionNumber)}
        />
      ) : null}
      {records.fastestTo10000 ? (
        <RecordRow
          label="Fastest to 10,000 🔥"
          value={`${formatEditionNumber(records.fastestTo10000.editionNumber)} / ${paceValue(records.fastestTo10000)}`}
          href={message(records.fastestTo10000.editionNumber, records.fastestTo10000.publicNumber)}
          wallHref={wall(records.fastestTo10000.editionNumber)}
          wallLabel={label(records.fastestTo10000.editionNumber)}
        />
      ) : null}
      <RecordRow
        label="Largest message minute"
        value={
          records.largestFinalMinute
            ? `${formatEditionNumber(records.largestFinalMinute.editionNumber)} · ${formatCount(records.largestFinalMinute.peakMessagesPerMinute)} / min`
            : "—"
        }
        href={records.largestFinalMinute ? wall(records.largestFinalMinute.editionNumber) : undefined}
        wallHref={records.largestFinalMinute ? wall(records.largestFinalMinute.editionNumber) : undefined}
        wallLabel={records.largestFinalMinute ? label(records.largestFinalMinute.editionNumber) : undefined}
      />
      {records.largestReactionMinute ? (
        <RecordRow
          label="Largest reaction minute"
          value={`${formatEditionNumber(records.largestReactionMinute.editionNumber)} · ${formatCount(records.largestReactionMinute.peakReactionsPerMinute)} 🔥 / min`}
          href={wall(records.largestReactionMinute.editionNumber)}
          wallHref={wall(records.largestReactionMinute.editionNumber)}
          wallLabel={label(records.largestReactionMinute.editionNumber)}
        />
      ) : null}
      {records.largestReactionHour ? (
        <RecordRow
          label="Most reactions in one hour"
          value={`${formatEditionNumber(records.largestReactionHour.editionNumber)} · ${formatCount(records.largestReactionHour.mostReactionsInOneHour)} 🔥`}
          href={wall(records.largestReactionHour.editionNumber)}
          wallHref={wall(records.largestReactionHour.editionNumber)}
          wallLabel={label(records.largestReactionHour.editionNumber)}
        />
      ) : null}
    </dl>
  );
}
