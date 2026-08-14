"use client";

import { useEffect, useState } from "react";
import { SharePanel } from "@/components/share-panel";
import { WallKeyPanel } from "@/components/wall-key-panel";
import { remainingLabel, remainingMsFrom } from "@/lib/event/remaining";
import { sharePayloadForMessage } from "@/lib/share/copy";
import { formatPublicNumber } from "@/lib/utils";

type Props = {
  publicNumber: number;
  text: string;
  endsAt: string;
  serverNow: string;
  ownershipToken: string;
  simulation?: boolean;
};

export function PublishSuccess({
  publicNumber,
  text,
  endsAt,
  serverNow,
  ownershipToken,
  simulation = false,
}: Props) {
  const href = `/message/${publicNumber}`;
  const [now, setNow] = useState(() => new Date(serverNow).getTime());
  const remaining = remainingLabel(endsAt, now);
  const live = remainingMsFrom(endsAt, now) > 0;
  const payload = sharePayloadForMessage({
    event: {
      phase: live ? "live" : "archived",
      endsAt,
      serverNow: new Date(now).toISOString(),
    },
    message: { publicNumber, isRemoved: false, finalRank: null },
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
        MESSAGE {formatPublicNumber(publicNumber)}
      </p>
      <p className="mt-6 font-display text-2xl leading-snug text-paper sm:text-3xl">“{text}”</p>
      <p className="mt-4 text-sm text-mist">Your sentence is now part of The Wall.</p>
      <p className="mt-8 font-mono text-sm tabular text-mist">🔥 0</p>
      <p className="mt-3 font-mono text-xs tabular tracking-[0.18em] text-ash" role="timer">
        {remaining}
      </p>
      {ownershipToken ? (
        <div className="mt-10 text-left">
          <WallKeyPanel
            wallKey={ownershipToken}
            publicNumber={publicNumber}
            text={text}
            emphasis="keep"
          />
        </div>
      ) : null}
      <div className="mt-10 flex flex-col gap-3">
        <SharePanel payload={payload} via="publish" primaryLabel="Share your message" />
        {simulation && ownershipToken ? (
          <button
            type="button"
            className="btn btn-ember w-full"
            onClick={() => {
              void fetch("/api/simulate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "close" }),
              }).then((res) => {
                if (!res.ok) return;
                window.location.href = "/archive";
              });
            }}
          >
            Finish this Wall and open the archive
          </button>
        ) : null}
        <a
          href={href}
          className="btn btn-line w-full"
        >
          Open {formatPublicNumber(publicNumber)}
        </a>
      </div>
      <p className="mt-4 break-all font-mono text-[11px] text-ash">{href}</p>
      <p className="mt-6 text-xs leading-relaxed text-ash">
        Share the sentence. Never share your Wall Key. The public certificate never includes it.
      </p>
    </div>
  );
}
