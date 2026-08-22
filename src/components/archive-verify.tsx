import Link from "next/link";
import { formatArchiveFingerprint } from "@/lib/archive/verify";
import {
  editionPath,
  formatCount,
  formatPublicDate,
  formatWallEdition,
} from "@/lib/utils";

export type ArchiveVerifyProps = {
  editionNumber: number;
  title: string;
  totalMessages: number;
  finalizedAt: string;
  archiveHash: string | null;
  merkleRoot: string | null;
  matches: boolean;
  archiveUri?: string | null;
  proofRef?: string | null;
};

export function ArchiveVerifyView({
  editionNumber,
  title,
  totalMessages,
  finalizedAt,
  archiveHash,
  merkleRoot,
  matches,
  archiveUri,
  proofRef,
}: ArchiveVerifyProps) {
  const wall = editionPath(editionNumber);
  const fingerprint = archiveHash ? formatArchiveFingerprint(archiveHash) : null;
  const root = merkleRoot ? formatArchiveFingerprint(merkleRoot) : null;
  const sealed = Boolean(archiveHash && merkleRoot);
  const verified = sealed && matches;

  return (
    <article className="archive-exhibit mx-auto max-w-xl p-7 sm:p-10">
      <p className="kicker text-bronze">{verified ? "Verified archive" : "Archive not verified"}</p>
      <h1 className="permanence-title mt-5">{formatWallEdition(editionNumber)}</h1>
      <p className="mt-3 font-mono text-xs tracking-[0.14em] text-mist">{title}</p>
      <span className="title-rule mt-6 block" aria-hidden="true" />

      <dl className="mt-8 space-y-6">
        <div>
          <dt className="kicker">Messages</dt>
          <dd className="mt-2 font-mono text-2xl tabular text-paper">{formatCount(totalMessages)}</dd>
        </div>
        <div>
          <dt className="kicker">Finalized</dt>
          <dd className="mt-2 font-display text-2xl text-paper">{formatPublicDate(finalizedAt)}</dd>
        </div>
        <div>
          <dt className="kicker">Archive fingerprint</dt>
          <dd className="mt-2 font-mono text-2xl tracking-[0.12em] text-bronze sm:text-3xl">
            {fingerprint ?? "Seal incomplete"}
          </dd>
          {archiveHash ? (
            <dd className="mt-2 break-all font-mono text-[0.7rem] tracking-wide text-ash">{archiveHash}</dd>
          ) : null}
        </div>
        <div>
          <dt className="kicker">Merkle root</dt>
          <dd className="mt-2 font-mono text-2xl tracking-[0.12em] text-bronze sm:text-3xl">
            {root ?? "Seal incomplete"}
          </dd>
          {merkleRoot ? (
            <dd className="mt-2 break-all font-mono text-[0.7rem] tracking-wide text-ash">{merkleRoot}</dd>
          ) : null}
        </div>
      </dl>

      <p className="mt-8 font-mono text-xs tracking-[0.16em] text-bronze">
        {!sealed
          ? "This Wall is not verified. The seal has not been recorded."
          : matches
            ? "The working copy still matches this seal."
            : "The working copy no longer matches this seal."}
      </p>

      <div className="mt-10 space-y-4 text-[1.05rem] leading-relaxed text-mist">
        <p>
          Forever here means this day was frozen into a public file, then given a
          fingerprint. Anyone can download that file and check the fingerprint.
          You do not need a wallet, a chain, or a specialist to do that.
        </p>
        <p>
          The fingerprint is a short reading of a checksum of the whole file. If
          one public sentence later changes, the fingerprint changes. The Merkle
          root is a second checksum built from every sentence — useful if you
          keep your own copy. You can ignore it if the fingerprint is enough.
        </p>
        <p>
          The site database is a working copy the pages read. It is not, by
          itself, permanent storage. Permanence is the sealed file, its
          fingerprint, the download on this site, and any extra copies listed
          below.
        </p>
      </div>

      {archiveUri || proofRef ? (
        <dl className="mt-8 space-y-4 text-sm">
          {archiveUri ? (
            <div>
              <dt className="kicker">Independent copy</dt>
              <dd className="mt-2 break-all font-mono text-xs text-mist">{archiveUri}</dd>
            </div>
          ) : null}
          {proofRef ? (
            <div>
              <dt className="kicker">Independent notice</dt>
              <dd className="mt-2 break-all font-mono text-xs text-mist">{proofRef}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="mt-10 flex flex-wrap gap-3">
        <a href={`${wall}/download`} className="btn btn-line" download>
          Download the archive
        </a>
        <a href={`${wall}/manifest`} className="btn btn-line" download>
          Download the manifest
        </a>
        <Link href={wall} className="btn-ghost kicker hover:text-paper">
          Return to the edition →
        </Link>
      </div>
    </article>
  );
}
