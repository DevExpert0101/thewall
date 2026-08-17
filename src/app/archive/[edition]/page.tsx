import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArchiveBrowser } from "@/components/archive-browser";
import { SharePanel } from "@/components/share-panel";
import { sharePayloadForWinner } from "@/lib/share/copy";
import { formatArchiveFingerprint } from "@/lib/archive/verify";
import { loadCanonicalArchive, loadEditionRecords, loadSealedEdition } from "@/lib/data/editions";
import { loadMonumentForEdition } from "@/lib/monument/store";
import { formatMonumentNumber } from "@/lib/monument/format";
import { listMessages } from "@/lib/data/messages";
import { isSimulation } from "@/lib/env";
import { publicPageMetadata } from "@/lib/share/metadata";
import type { EditionHighlight } from "@/lib/types";
import {
  editionNumberOf,
  editionPath,
  editionVerifyPath,
  formatCount,
  formatEditionDate,
  formatMessageMark,
  formatObjectIdentity,
  formatWallEdition,
  monumentPath,
  parseEdition,
  wallTitle,
} from "@/lib/utils";
import { WALL_PAGE_SIZE } from "@/lib/wall/constants";

export const revalidate = 3600;

type Props = { params: Promise<{ edition: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const editionNumber = parseEdition((await params).edition);
  if (!editionNumber) return { title: "The Wall", robots: { index: false } };
  try {
    const event = await loadSealedEdition(editionNumber);
    return publicPageMetadata({
      event,
      path: editionPath(editionNumber),
      kind: "milestone",
    });
  } catch {
    return { title: "Wall not found", robots: { index: false } };
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
  const listed = await listMessages({
    eventId: event.id,
    sort: "hot",
    limit: WALL_PAGE_SIZE,
    endsAt: event.endsAt,
  });
  const n = editionNumberOf(event);
  const wall = editionPath(n);
  const monument = await loadMonumentForEdition(n).catch(() => null);
  const archiveUri = event.archiveUri?.trim() || null;

  return (
    <main className="archive-edition mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <p className="kicker">
        <Link href="/archive" className="hover:text-paper">
          Archive
        </Link>
        {isSimulation() ? " · Simulation" : ""}
      </p>
      <p className="edition-mark mt-6">
        {formatWallEdition(n)}
      </p>
      <h1 className="permanence-title mt-3">{wallTitle(event)}</h1>
      <p className="mt-4 font-mono text-xs tracking-[0.14em] text-mist">
        {formatEditionDate(event.startsAt)}
      </p>
      <p className="mt-3 kicker text-bronze">Sealed</p>
      <span className="title-rule mt-6 block" aria-hidden="true" />
      <p className="mt-6 font-mono text-xs tracking-[0.14em] text-bronze">
        {formatCount(event.totalMessages)} voices · {formatCount(event.totalReactions)} 🔥 ·{" "}
        {records.durationHours} hours
      </p>
      <p className="lede mt-6 max-w-xl">
        This Wall is sealed. Publishing, 🔥, and rank movement have stopped. What
        you read here is the final public record.
      </p>

      {event.themeQuestion ? <p className="lede mt-6 max-w-xl">{event.themeQuestion}</p> : null}

      {records.winning ? (
        <Exhibit
          kicker="The Victor"
          row={records.winning}
          edition={n}
          href={`${wall}/${records.winning.publicNumber}`}
          foot={`${formatCount(records.winning.reactionCount)} 🔥 · Final rank #1${monument ? ` · Now preserved as ${formatMonumentNumber(monument.monumentNumber)}` : ""}`}
          featured
          share={
            records.winning.isRemoved
              ? undefined
              : sharePayloadForWinner({
                  editionNumber: n,
                  publicNumber: records.winning.publicNumber,
                  text: records.winning.text,
                  reactionCount: records.winning.reactionCount,
                })
          }
        />
      ) : null}

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {records.first ? (
          <Exhibit
            kicker="First Message"
            row={records.first}
            edition={n}
            href={`${wall}/${records.first.publicNumber}`}
          />
        ) : null}
        {records.last ? (
          <Exhibit
            kicker="Final Message"
            row={records.last}
            edition={n}
            href={`${wall}/${records.last.publicNumber}`}
          />
        ) : null}
      </div>

      <dl className="mt-14 grid gap-8 text-sm sm:grid-cols-3">
        <Meta label="Voices" value={formatCount(event.totalMessages)} />
        <Meta label="Fire" value={`${formatCount(event.totalReactions)} 🔥`} />
        <Meta
          label="Finalized"
          value={event.finalizedAt ? formatEditionDate(event.finalizedAt) : "Sealed"}
        />
      </dl>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href={`${wall}/records`} className="btn btn-line">
          Record Book
        </Link>
        <Link href={`${wall}/random`} className="btn btn-line">
          Random
        </Link>
        <Link href={editionVerifyPath(n)} className="btn btn-line">
          Verify this Wall
        </Link>
        {monument ? (
          <Link href={monumentPath(monument.monumentNumber)} className="btn btn-primary">
            View Monument entry
          </Link>
        ) : null}
        {records.winning ? (
          <Link href="/claim" className="btn btn-line">
            Winner claim
          </Link>
        ) : null}
      </div>

      <section className="mt-16 border-t border-line pt-12">
        <p className="kicker">Verification</p>
        <p className="lede mt-4 max-w-xl">
          The live site is a working copy. The sealed file and its fingerprint
          are the public record of this day.
        </p>
        <dl className="mt-6 grid gap-6 text-sm sm:grid-cols-2">
          <Meta
            label="Archive fingerprint"
            value={
              (proof?.archiveHash ?? event.archiveHash)
                ? formatArchiveFingerprint(proof?.archiveHash ?? event.archiveHash ?? "")
                : "Pending local seal"
            }
            mono
          />
          <Meta
            label="Merkle root"
            value={
              (proof?.merkleRoot ?? event.merkleRoot)
                ? formatArchiveFingerprint(proof?.merkleRoot ?? event.merkleRoot ?? "")
                : "Pending local seal"
            }
            mono
          />
          {archiveUri ? <Meta label="Independent copy" value={archiveUri} mono /> : null}
          {event.proofTx ? <Meta label="Independent notice" value={event.proofTx} mono /> : null}
        </dl>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={editionVerifyPath(n)} className="btn btn-line">
            How to check
          </Link>
          <a href={`${wall}/download`} className="btn btn-line" download>
            Download this Wall
          </a>
        </div>
      </section>

      <section className="mt-16">
        <p className="kicker">The frozen wall</p>
        <h2 className="section-title mt-4">Search this Wall</h2>
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

function Exhibit({
  kicker,
  row,
  edition,
  href,
  foot,
  featured = false,
  share,
}: {
  kicker: string;
  row: EditionHighlight;
  edition: number;
  href: string;
  foot?: string;
  featured?: boolean;
  share?: ReturnType<typeof sharePayloadForWinner>;
}) {
  return (
    <section className={`archive-exhibit mt-10 p-7 sm:p-10 ${featured ? "max-w-2xl" : ""}`}>
      <p className="kicker text-bronze">{kicker}</p>
      <p className="mt-4 font-mono text-sm tracking-[0.18em] text-bronze">
        {formatObjectIdentity(row.publicNumber, edition)}
      </p>
      <p className={`mt-5 font-display leading-snug ${featured ? "text-3xl sm:text-4xl" : "text-2xl"} ${row.isRemoved ? "text-ash italic" : "text-paper"}`}>
        {row.isRemoved ? row.text : `“${row.text}”`}
      </p>
      {foot ? <p className="mt-8 font-mono text-xs tracking-[0.14em] text-mist">{foot}</p> : null}
      <Link href={href} className="btn-ghost mt-6 inline-flex kicker hover:text-paper">
        {formatMessageMark(row.publicNumber)} →
      </Link>
      {share ? (
        <div className="mt-8 border-t border-line pt-6">
          <SharePanel payload={share} via="detail" primaryLabel="Share this sentence" preview />
        </div>
      ) : null}
    </section>
  );
}

function Meta({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="kicker">{label}</dt>
      <dd className={`mt-2 text-paper ${mono ? "break-all font-mono text-xs tracking-wide text-mist" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
