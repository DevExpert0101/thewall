import Link from "next/link";
import { CANVAS_FONT_PX, CANVAS_LINE_HEIGHT } from "@/lib/monument/fit";
import type { MonumentCanvasGeometry, MonumentEntry } from "@/lib/monument/types";
import { editionMessagePath } from "@/lib/utils";

export function MonumentCanvas({
  canvas,
  entries,
}: {
  canvas: MonumentCanvasGeometry;
  entries: MonumentEntry[];
}) {
  return (
    <div className="monument-viewport">
      <div className="monument-canvas">
        {entries.map((entry) => (
          <Link
            key={entry.id}
            href={editionMessagePath(entry.editionNumber, entry.originalPublicNumber)}
            className={`monument-sentence${entry.isRemoved ? " is-removed" : ""}`}
            style={{
              left: `${(entry.x / canvas.width) * 100}%`,
              top: `${(entry.y / canvas.height) * 100}%`,
              width: `${(entry.width / canvas.width) * 100}%`,
              fontSize: CANVAS_FONT_PX,
              lineHeight: CANVAS_LINE_HEIGHT,
            }}
          >
            {entry.sentenceSnapshot}
          </Link>
        ))}
      </div>
    </div>
  );
}
