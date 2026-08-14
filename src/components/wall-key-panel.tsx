"use client";

import { useState } from "react";
import { formatWallKey } from "@/lib/ownership/wall-key";
import { downloadOwnershipCard } from "@/lib/ownership/receipt";

export function WallKeyPanel({
  wallKey,
  publicNumber,
  text,
  publishedAt,
  emphasis = "save",
}: {
  wallKey: string;
  publicNumber?: number;
  text?: string;
  publishedAt?: string;
  emphasis?: "save" | "keep";
}) {
  const [copied, setCopied] = useState(false);
  const display = formatWallKey(wallKey);

  return (
    <div className="pay-plaque p-5 sm:p-6">
      <p className="kicker text-bronze">Your Wall Key</p>
      <p className="mt-4 font-mono text-[clamp(1.35rem,5vw,1.85rem)] tracking-[0.18em] text-paper">
        {display}
      </p>
      <p className="mt-4 text-sm leading-relaxed text-mist">
        {emphasis === "save"
          ? "Keep this somewhere safe. You will need it if your message wins, or to retrieve your certificate. We cannot recover it."
          : "This key proves control of your sentence. It is not shown on the wall. We cannot recover it."}
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="btn btn-line w-full sm:w-auto"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(display);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copied" : "Copy Wall Key"}
        </button>
        <button
          type="button"
          className="btn btn-primary w-full sm:w-auto"
          onClick={() =>
            downloadOwnershipCard({
              wallKey: display,
              publicNumber,
              text,
              publishedAt,
            })
          }
        >
          Download ownership card
        </button>
      </div>
    </div>
  );
}
