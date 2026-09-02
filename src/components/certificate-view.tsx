"use client";

import { CertificateQr } from "@/components/certificate-qr";
import { SharePanel } from "@/components/share-panel";
import { publicCertificateImagePath } from "@/lib/certificate/public";
import { ARCHIVAL_REMOVAL_TEXT } from "@/lib/constants";
import { sharePayloadForMessage } from "@/lib/share/copy";
import { formatCount, formatObjectIdentity, formatUtcTime, formatWallEdition } from "@/lib/utils";
import type { CertificatePayload } from "@/lib/types";

export function CertificateView({ data }: { data: CertificatePayload }) {
  const removed = data.text === ARCHIVAL_REMOVAL_TEXT;
  const payload = sharePayloadForMessage({
    event: {
      phase: data.finalRank ? "archived" : "finalizing",
      endsAt: data.publishedAt,
      serverNow: data.publishedAt,
      editionNumber: data.editionNumber,
    },
    message: {
      publicNumber: data.publicNumber,
      text: data.text,
      isRemoved: removed,
      finalRank: data.finalRank,
      reactionCount: data.reactionCount,
    },
  });
  const archiveProof = data.merkleRoot || data.archiveHash || data.proofTx;
  const image = (ratio: string) => publicCertificateImagePath(data.publicNumber, ratio);

  return (
    <main className="certificate-page min-h-dvh bg-void px-4 py-12 print:bg-white print:px-0 print:py-0 print:text-black sm:px-8">
      <article className="certificate-sheet mx-auto flex min-h-[80dvh] max-w-3xl flex-col justify-between p-8 sm:p-14 print:min-h-[auto] print:max-w-none print:border-2 print:border-black print:bg-white print:p-16">
        <span className="certificate-corners" aria-hidden="true" />
        <header>
          <p className="certificate-wordmark print:text-black">THE WALL</p>
          <h1 className="kicker mt-4 print:text-neutral-600">PUBLIC CERTIFICATE</h1>
          <p className="mt-3 font-display text-2xl text-paper print:text-black">
            {data.editionNumber
              ? formatWallEdition(data.editionNumber)
              : data.eventTitle}
          </p>
          <p className="mt-2 text-sm text-mist print:text-neutral-700">{data.eventDate}</p>
        </header>
        <div>
          <p className="font-mono text-sm tracking-[0.18em] text-bronze print:text-neutral-800">
            {formatObjectIdentity(data.publicNumber, data.editionNumber)}
          </p>
          <p className={`certificate-quote mt-6 ${removed ? "text-ash italic print:text-neutral-600" : ""}`}>
            {removed ? data.text : `“${data.text}”`}
          </p>
          <p className="mt-8 font-mono text-sm text-mist print:text-neutral-700">
            Place on the Wall: {data.finalRank ? `#${data.finalRank}` : "Rank pending"}
          </p>
          <p className="mt-2 font-mono text-sm">
            {formatCount(data.reactionCount)} 🔥
            <span className="sr-only"> reactions</span>
          </p>
          <p className="mt-2 font-mono text-sm text-ash print:text-neutral-600">
            Published {formatUtcTime(data.publishedAt)}
          </p>
          <p className="mt-4 break-all font-mono text-xs text-ash print:text-neutral-600">
            {archiveProof
              ? `Seal ${archiveProof}`
              : "The seal is recorded when this Wall is finished."}
          </p>
        </div>
        <footer className="certificate-close">
          <div>
            {typeof data.totalMessages === "number" ? (
              <p className="mb-4 font-mono text-xs tracking-[0.14em] text-mist print:text-neutral-700">
                {formatCount(data.totalMessages)} people spoke that day. This was one of them.
              </p>
            ) : null}
            <p className="certificate-colophon print:text-neutral-700">
              {formatObjectIdentity(data.publicNumber, data.editionNumber)}
            </p>
          </div>
          <CertificateQr publicNumber={data.publicNumber} />
        </footer>
      </article>
      <div className="certificate-tools mx-auto mt-8 max-w-3xl print:hidden">
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={image("print")}
            className="btn btn-primary"
            rel="nofollow"
            download="the-wall-certificate.png"
          >
            Download image
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn btn-line"
          >
            Print / PDF
          </button>
        </div>
        <p className="kicker mt-6">Also save as</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <a href={image("1200x630")} className="btn-ghost" rel="nofollow" aria-label="1200×630 certificate image">
            1200×630
          </a>
          <a href={image("1:1")} className="btn-ghost" rel="nofollow" aria-label="Square certificate image">
            Square
          </a>
          <a href={image("9:16")} className="btn-ghost" rel="nofollow" aria-label="Portrait certificate image">
            Portrait
          </a>
        </div>
        <div className="mt-6 border-t border-line pt-4">
          <p className="mb-3 text-sm text-ash">
            This is the Certificate. Never share your Wall Key.
          </p>
          <SharePanel payload={payload} via="detail" preview cards={false} />
        </div>
      </div>
    </main>
  );
}
