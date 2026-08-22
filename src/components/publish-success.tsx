"use client";

import { useEffect, useState } from "react";
import { SharePanel } from "@/components/share-panel";
import { WallKeyPanel } from "@/components/wall-key-panel";
import { publicCertificatePath } from "@/lib/certificate/public";
import { remainingLabel, remainingMsFrom } from "@/lib/event/remaining";
import { sharePayloadForMessage } from "@/lib/share/copy";
import { BRAND } from "@/lib/brand";
import { editionNumberOf, formatMessageMark, formatWallPlace } from "@/lib/utils";

type Props = {
  publicNumber: number;
  text: string;
  endsAt: string;
  serverNow: string;
  ownershipToken: string;
  editionNumber?: number;
};

export function PublishSuccess({
  publicNumber,
  text,
  endsAt,
  serverNow,
  ownershipToken,
  editionNumber,
}: Props) {
  const href = `/message/${publicNumber}`;
  const edition = editionNumberOf({ editionNumber });
  const [now, setNow] = useState(() => new Date(serverNow).getTime());
  const remaining = remainingLabel(endsAt, now);
  const live = remainingMsFrom(endsAt, now) > 0;
  const payload = sharePayloadForMessage({
    event: {
      phase: live ? "live" : "archived",
      endsAt,
      serverNow: new Date(now).toISOString(),
      editionNumber: edition,
    },
    message: { publicNumber, text, isRemoved: false, finalRank: null, reactionCount: 0 },
  });

  useEffect(() => {
    const originClient = Date.now();
    const originServer = new Date(serverNow).getTime();
    const id = window.setInterval(() => {
      setNow(originServer + (Date.now() - originClient));
    }, 250);
    return () => window.clearInterval(id);
  }, [serverNow]);

  return (
    <div className="animate-monument mt-6 text-center">
      <p className="font-display text-[clamp(2rem,8vw,3.4rem)] leading-[0.95] tracking-tight text-paper">
        YOU ARE ON THE WALL.
      </p>
      <span className="mx-auto mt-4 block h-px w-24 origin-center bg-ember animate-ember-draw" aria-hidden="true" />
      <p className="mt-6 font-mono text-sm tracking-[0.28em] text-bronze">
        {formatMessageMark(publicNumber)}
      </p>
      <blockquote className="inscribe mx-auto mt-8 max-w-lg p-6 text-left sm:p-8">
        <p className="font-display text-2xl leading-snug text-paper sm:text-3xl">“{text}”</p>
      </blockquote>
      <p className="mt-4 text-sm text-mist">
        Your sentence now has a place in {formatWallPlace(edition)}.
      </p>
      <p className="mt-4 font-mono text-xs tabular tracking-[0.18em] text-ash" aria-hidden="true">
        {remaining}
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <SharePanel
          payload={payload}
          via="publish"
          primaryLabel="Share this sentence"
          preview
        />
        <a href={href} className="btn btn-line w-full">
          See this sentence
        </a>
        {live ? (
          <a href="/watch" className="btn-ghost inline-flex min-h-11 items-center justify-center text-xs tracking-[0.16em]">
            Watch the Wall
          </a>
        ) : null}
      </div>
      {ownershipToken ? (
        <div className="mt-10 text-left">
          <WallKeyPanel
            wallKey={ownershipToken}
            publicNumber={publicNumber}
            text={text}
          />
        </div>
      ) : null}
      <aside className="pay-plaque mt-6 p-5 text-left">
        <p className="kicker text-bronze">{BRAND.certificatePublic}</p>
        <p className="mt-3 text-sm leading-relaxed text-mist">
          The {BRAND.certificate} for this sentence — number, 🔥, and seal. Not your {BRAND.wallKey}.
        </p>
        <a href={publicCertificatePath(publicNumber)} className="btn btn-line mt-5 w-full">
          Open {BRAND.certificate}
        </a>
      </aside>
      <p className="mt-6 text-xs leading-relaxed text-ash">
        Share the sentence. Never share your {BRAND.wallKey}. The {BRAND.certificate} never includes it.
      </p>
    </div>
  );
}
