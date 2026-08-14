"use client";

import { SharePanel } from "@/components/share-panel";
import { ARCHIVAL_REMOVAL_TEXT } from "@/lib/constants";
import { sharePayloadForMessage } from "@/lib/share/copy";
import { formatCount, formatPublicNumber, formatUtcTime } from "@/lib/utils";
import type { CertificatePayload } from "@/lib/types";

export function CertificateView({
  data,
  token,
}: {
  data: CertificatePayload;
  token: string;
}) {
  const removed = data.text === ARCHIVAL_REMOVAL_TEXT;
  const payload = sharePayloadForMessage({
    event: {
      phase: data.finalRank ? "archived" : "finalizing",
      endsAt: data.publishedAt,
      serverNow: data.publishedAt,
    },
    message: {
      publicNumber: data.publicNumber,
      isRemoved: removed,
      finalRank: data.finalRank,
    },
  });

  return (
    <main className="certificate-page min-h-dvh bg-void px-4 py-12 print:bg-white print:px-0 print:py-0 print:text-black sm:px-8">
      <article className="certificate-sheet mx-auto flex min-h-[80dvh] max-w-3xl flex-col justify-between border border-line p-8 sm:p-14 print:min-h-[auto] print:max-w-none print:border-2 print:border-black print:bg-white print:p-16">
        <header>
          <p className="kicker print:text-neutral-600">Certificate</p>
          <p className="mt-3 font-display text-2xl text-paper print:text-black">{data.eventTitle}</p>
          <p className="mt-2 text-sm text-mist print:text-neutral-700">{data.eventDate}</p>
        </header>
        <div>
          <p className="font-mono text-sm tracking-[0.22em] text-bronze print:text-neutral-800">
            MESSAGE {formatPublicNumber(data.publicNumber)}
          </p>
          <p className={`mt-6 font-display text-3xl leading-snug sm:text-5xl ${removed ? "text-ash italic print:text-neutral-600" : ""}`}>
            {removed ? data.text : `“${data.text}”`}
          </p>
          <p className="mt-8 font-mono text-sm text-mist print:text-neutral-700">
            Final Rank: {data.finalRank ? `#${data.finalRank}` : "Pending finalization"}
          </p>
          <p className="mt-2 font-mono text-sm">
            {formatCount(data.reactionCount)} 🔥
          </p>
          <p className="mt-2 font-mono text-sm text-ash print:text-neutral-600">
            Published {formatUtcTime(data.publishedAt)}
          </p>
        </div>
        <footer>
          <p className="kicker text-mist print:text-neutral-700">
            {data.tagline}
          </p>
          <div className="mt-8 flex flex-col gap-3 print:hidden">
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={`/certificate/${token}/image?ratio=print`}
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
            <p className="kicker">Also save as</p>
            <div className="flex flex-wrap gap-3">
              <a href={`/certificate/${token}/image?ratio=1200x630`} className="btn-ghost" rel="nofollow">
                1200×630
              </a>
              <a href={`/certificate/${token}/image?ratio=1:1`} className="btn-ghost" rel="nofollow">
                Square
              </a>
              <a href={`/certificate/${token}/image?ratio=9:16`} className="btn-ghost" rel="nofollow">
                Portrait
              </a>
            </div>
            <div className="border-t border-line pt-4">
              <p className="mb-3 text-sm text-ash">
                Share the public sentence — never your Wall Key or this private link.
              </p>
              <SharePanel payload={payload} via="detail" />
            </div>
          </div>
        </footer>
      </article>
    </main>
  );
}
