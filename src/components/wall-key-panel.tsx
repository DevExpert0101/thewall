"use client";

import { useState } from "react";
import { BRAND } from "@/lib/brand";
import { formatWallKey } from "@/lib/ownership/wall-key";
import { downloadOwnershipCard, downloadPrivateReceipt } from "@/lib/ownership/receipt";
import { formatPublicNumber } from "@/lib/utils";

export function WallKeyPanel({
  wallKey,
  publicNumber,
  text,
  publishedAt,
}: {
  wallKey: string;
  publicNumber?: number;
  text?: string;
  publishedAt?: string;
}) {
  const [copied, setCopied] = useState(false);
  const display = formatWallKey(wallKey);
  const number = publicNumber ? formatPublicNumber(publicNumber) : null;

  return (
    <aside className="pay-plaque p-5 sm:p-6">
      <p className="kicker text-bronze">{BRAND.ownershipReceiptMark}</p>
      <p className="mt-2 text-sm text-mist">{BRAND.wallKeyContains}</p>
      <h2 className="mt-6 font-display text-2xl tracking-tight text-paper sm:text-3xl">
        {BRAND.wallKeyYours}
      </h2>
      <div className="wall-key-well mt-5 px-3 py-4 sm:px-4">
        <p className="wall-key-value text-center font-mono text-[clamp(1.05rem,4.2vw,1.65rem)] tracking-[0.12em] text-paper">
          {display}
        </p>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-mist">
        {number
          ? `This private key proves that Message ${number} is yours.`
          : "This private key will prove the sentence is yours after it is published."}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-mist">Keep it somewhere safe.</p>
      <p className="mt-2 text-sm leading-relaxed text-mist">We cannot recover it.</p>
      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(display);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copied" : `Copy ${BRAND.wallKey}`}
        </button>
        <span className="sr-only" aria-live="polite">
          {copied ? `${BRAND.wallKey} copied` : ""}
        </span>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="btn btn-line w-full sm:flex-1"
            onClick={() =>
              downloadPrivateReceipt({
                wallKey: display,
                publicNumber,
                text,
                publishedAt,
              })
            }
          >
            Save {BRAND.ownershipReceipt}
          </button>
          <button
            type="button"
            className="btn btn-line w-full sm:flex-1"
            onClick={() =>
              downloadOwnershipCard({
                wallKey: display,
                publicNumber,
                text,
                publishedAt,
              })
            }
          >
            Save as image
          </button>
        </div>
      </div>
    </aside>
  );
}
