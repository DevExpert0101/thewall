"use client";

import { useEffect, useState } from "react";
import { WallKeyPanel } from "@/components/wall-key-panel";
import { publicCertificatePath } from "@/lib/certificate/public";
import { getOwnedMark } from "@/lib/ownership/store";
import { formatObjectIdentity } from "@/lib/utils";

export function OwnedMark({
  publicNumber,
  reactionCount,
  finalRank,
  editionNumber,
}: {
  publicNumber: number;
  reactionCount: number;
  finalRank: number | null;
  editionNumber?: number;
}) {
  const [mark, setMark] = useState<ReturnType<typeof getOwnedMark>>(null);

  useEffect(() => {
    // localStorage is client-only; sync after mount without blocking SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from local store
    setMark(getOwnedMark(publicNumber));
  }, [publicNumber]);

  if (!mark) return null;

  return (
    <div className="mb-8 space-y-4">
      <aside className="pay-plaque p-5">
        <p className="kicker text-bronze">Your mark</p>
        <p className="mt-3 font-mono text-sm tracking-[0.18em] text-paper">
          {formatObjectIdentity(publicNumber, editionNumber)}
        </p>
        <p className="mt-2 text-sm text-mist">
          🔥 {reactionCount}
          {finalRank ? ` · Current rank #${finalRank}` : ""}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <a href={publicCertificatePath(publicNumber)} className="btn-ghost inline-flex">
            Certificate →
          </a>
          <a href={`/claim/${publicNumber}`} className="btn-ghost inline-flex">
            Claim with Wall Key →
          </a>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ash">
          The Certificate is safe to share. Your Wall Key is not.
        </p>
      </aside>
      <WallKeyPanel
        wallKey={mark.claimKey}
        publicNumber={publicNumber}
        text={mark.text}
        publishedAt={mark.publishedAt}
      />
    </div>
  );
}
