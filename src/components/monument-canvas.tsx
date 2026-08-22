"use client";

import Link from "next/link";
import * as Tooltip from "@radix-ui/react-tooltip";
import { CANVAS_FONT_PX, CANVAS_LINE_HEIGHT } from "@/lib/monument/fit";
import { formatMonumentNumber, formatVictorOfWall } from "@/lib/monument/format";
import type { MonumentCanvasGeometry, MonumentEntry } from "@/lib/monument/types";
import { editionMessagePath } from "@/lib/utils";

function sentenceStyle(entry: MonumentEntry, canvas: MonumentCanvasGeometry) {
  return {
    left: `${(entry.x / canvas.width) * 100}%`,
    top: `${(entry.y / canvas.height) * 100}%`,
    width: `${(entry.width / canvas.width) * 100}%`,
    fontSize: CANVAS_FONT_PX,
    lineHeight: CANVAS_LINE_HEIGHT,
  };
}

function sentenceClass(entry: MonumentEntry, freshIds: string[]) {
  return `monument-sentence${entry.isRemoved ? " is-removed" : ""}${freshIds.includes(entry.id) ? " is-carving" : ""}`;
}

function MonumentSentenceTooltip({ entry }: { entry: MonumentEntry }) {
  return (
    <div className="monument-tooltip-body">
      <p className="monument-tooltip-quote">{entry.isRemoved ? entry.text : `“${entry.text}”`}</p>
      <p className="monument-tooltip-meta">
        {formatMonumentNumber(entry.monumentNumber)} · {formatVictorOfWall(entry.editionNumber)}
      </p>
    </div>
  );
}

export function MonumentCanvas({
  canvas,
  entries,
  decorative = false,
  freshIds = [],
}: {
  canvas: MonumentCanvasGeometry;
  entries: MonumentEntry[];
  decorative?: boolean;
  freshIds?: string[];
}) {
  return (
    <div className={`monument-viewport${decorative ? " is-decorative" : ""}`}>
      <Tooltip.Provider delayDuration={180} skipDelayDuration={80}>
        <div className="monument-canvas">
          {entries.map((entry) => {
            const className = sentenceClass(entry, freshIds);
            const style = sentenceStyle(entry, canvas);
            if (decorative) {
              return (
                <p key={entry.id} className={className} style={style}>
                  {entry.sentenceSnapshot}
                </p>
              );
            }
            return (
              <Tooltip.Root key={entry.id}>
                <Tooltip.Trigger asChild>
                  <Link
                    href={editionMessagePath(entry.editionNumber, entry.originalPublicNumber)}
                    className={className}
                    style={style}
                  >
                    {entry.sentenceSnapshot}
                  </Link>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content className="monument-tooltip" side="top" sideOffset={8} collisionPadding={12}>
                    <MonumentSentenceTooltip entry={entry} />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            );
          })}
        </div>
      </Tooltip.Provider>
    </div>
  );
}
