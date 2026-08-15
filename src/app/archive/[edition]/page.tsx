import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArchiveBrowser } from "@/components/archive-browser";
import { loadCanonicalArchive, loadEditionRecords, loadSealedEdition } from "@/lib/data/editions";
import { listMessages } from "@/lib/data/messages";
import { isSimulation } from "@/lib/env";
import { publicPageMetadata } from "@/lib/share/metadata";
import {
  editionNumberOf,
  editionPath,
  formatCount,
  formatEditionDate,
  formatEditionNumber,
  formatPublicNumber,
  parseEdition,
  wallTitle,
} from "@/lib/utils";
import { WALL_PAGE_SIZE } from "@/lib/wall/constants";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ edition: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const editionNumber = parseEdition((await params).edition);
  if (!editionNumber) return { title: "Edition", robots: { index: false } };
  try {
    const event = await loadSealedEdition(editionNumber);
    return publicPageMetadata({
      event,
      path: editionPath(editionNumber),
      kind: "milestone",
    });
  } catch {
    return { title: "Edition not found", robots: { index: false } };
  }
}

export default async function EditionPage({ params }: Props) {
  if (isSimulation()) await connection();
  const editionNumber = parseEdition((await params).edition);
  if (!editionNumber) notFound();

  let event;
  try {
    event = await loadSealedEdition(editionNumber);
  } catch {
    notFound();
  }

  const records = await loadEditionRecords(event);
  const proof = await loadCanonicalArchive(event).catch(() => null);
  const listed = await listMessages({ eventId: event.id, sort: "hot", limit: WALL_PAGE_SIZE });
  const winning = records.winning;
  const n = editionNumberOf(event);

  return (
    <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="kicker">
        <Link href="/archive" className="hover:text-paper">
          Archive
        </Link>
        {isSimulation() ? " · Simulation" : ""}
      </p>
      <p className="mt-5 font-mono text-sm tracking-[0.22em] text-bronze">
        {formatEditionNumber(n)}
      </p>
      <h1 className="permanence-title mt-3">{wallTitle(event)}</h1>
      <p className="mt-3 font-mono text-xs tracking-[0.14em] text-mist">
        {formatEditionDate(event.startsAt)}
      </p>
      <span className="title-rule mt-6 block" aria-hidden="true" />
      <p className="mt-6 font-mono text-xs tracking-[0.14em] text-bronze">
        {formatCount(event.totalMessages)} messages · {formatCount(event.totalReactions)} 🔥 ·{" "}
        {records.durationHours} hours
      </p>
      <p className="lede mt-6 max-w-xl">
        This Wall is sealed. No new messages, reactions, or rank changes. The public
        record is the final moderated dataset.
      </p>

      {winning ? (
        <section className="pay-plaque shrine-plaque mt-14 max-w-2xl p-7 sm:p-10">
          <p className="kicker text-bronze">Winning message</p>
          <p className="mt-4 font-mono text-sm tracking-[0.22em] text-bronze">
            {formatPublicNumber(winning.publicNumber)}
          </p>
          <p className={`mt-5 font-display text-3xl leading-snug sm:text-4xl ${winning.isRemoved ? "text-ash italic" : "text-paper"}`}>
            {winning.isRemoved ? winning.text : `“${winning.text}”`}
          </p>
          <p className="mt-8 font-mono text-xs tracking-[0.14em] text-mist">
            {formatCount(winning.reactionCount)} 🔥 · Final rank #1
          </p>
        </section>
      ) : null}

      <dl className="mt-12 grid gap-8 text-sm sm:grid-cols-3">
        <Meta
          label="First message"
          value={records.first ? formatPublicNumber(records.first.publicNumber) : "—"}
          href={records.first ? `${editionPath(n)}/${records.first.publicNumber}` : undefined}
        />
        <Meta
          label="Last message"
          value={records.last ? formatPublicNumber(records.last.publicNumber) : "—"}
          href={records.last ? `${editionPath(n)}/${records.last.publicNumber}` : undefined}
        />
        <Meta
          label="Most reacted"
          value={records.mostReacted ? formatPublicNumber(records.mostReacted.publicNumber) : "—"}
          href={records.mostReacted ? `${editionPath(n)}/${records.mostReacted.publicNumber}` : undefined}
        />
        <Meta label="Total messages" value={formatCount(event.totalMessages)} />
        <Meta label="Total reactions" value={`${formatCount(event.totalReactions)} 🔥`} />
        <Meta label="Finalized" value={event.finalizedAt ? formatEditionDate(event.finalizedAt) : "Pending"} />
      </dl>

      <section className="mt-14 border-t border-line pt-10">
        <p className="kicker">Canonical proof</p>
        <dl className="mt-6 grid gap-6 text-sm sm:grid-cols-2">
          <Meta label="Archive hash" value={proof?.archiveHash ?? event.archiveHash ?? "Pending local seal"} mono />
          <Meta label="Merkle root" value={proof?.merkleRoot ?? event.merkleRoot ?? "Pending local seal"} mono />
          <Meta label="Permanent copy" value={event.archiveUri ?? "Downloadable JSON — off-site replica not published yet"} mono />
          <Meta label="On-chain proof" value={event.proofTx ?? "Not recorded on Base yet"} mono />
        </dl>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={`${editionPath(n)}/records`} className="btn btn-line">
            Record book
          </Link>
          <a href={`${editionPath(n)}/download`} className="btn btn-line" download>
            Download this Wall
          </a>
        </div>
      </section>

      <section className="mt-16">
        <p className="kicker">The frozen wall</p>
        <h2 className="section-title mt-4">Browse the complete edition</h2>
        {listed.messages.length === 0 ? (
          <div className="empty-monument mt-12">
            <p className="font-display text-3xl text-paper sm:text-4xl">No inscriptions remain public.</p>
            <p className="lede mx-auto mt-4 max-w-md">
              The clock closed on an empty stone — or every line was removed under policy.
            </p>
          </div>
        ) : (
          <ArchiveBrowser event={event} initial={listed.messages} initialCursor={listed.nextCursor} />
        )}
      </section>
    </main>
  );
}

function Meta({
  label,
  value,
  href,
  mono = false,
}: {
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="kicker">{label}</dt>
      <dd className={`mt-2 text-paper ${mono ? "break-all font-mono text-xs tracking-wide text-mist" : ""}`}>
        {href ? (
          <Link href={href} className="hover:text-gold">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
