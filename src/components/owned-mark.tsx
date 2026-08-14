"use client";

import { useEffect, useState } from "react";
import { getOwnedMark } from "@/lib/ownership/store";
import { formatPublicNumber } from "@/lib/utils";

export function OwnedMark({
  publicNumber,
  reactionCount,
  finalRank,
}: {
  publicNumber: number;
  reactionCount: number;
  finalRank: number | null;
}) {
  const [mark, setMark] = useState<ReturnType<typeof getOwnedMark>>(null);

  useEffect(() => {
    setMark(getOwnedMark(publicNumber));
  }, [publicNumber]);

  if (!mark) return null;

  return (
    <aside className="pay-plaque mb-8 p-5">
      <p className="kicker text-bronze">Your mark</p>
      <p className="mt-3 font-mono text-sm tracking-[0.18em] text-paper">
        {formatPublicNumber(publicNumber)}
      </p>
      <p className="mt-2 text-sm text-mist">
        🔥 {reactionCount}
        {finalRank ? ` · Current rank #${finalRank}` : ""}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <a
          href={`/certificate/${encodeURIComponent(mark.claimKey)}`}
          className="btn-ghost inline-flex"
        >
          Open certificate →
        </a>
        <a href={`/claim/${publicNumber}`} className="btn-ghost inline-flex">
          Claim with Wall Key →
        </a>
      </div>
    </aside>
  );
}
