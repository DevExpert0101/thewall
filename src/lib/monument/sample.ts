import { monumentCanvasFromEnv, plotForPosition } from "@/lib/monument/canvas";
import type { MonumentEntry } from "@/lib/monument/types";

export function sampleMonumentEntry(overrides: Partial<MonumentEntry> = {}): MonumentEntry {
  const plot = plotForPosition(overrides.monumentNumber ?? overrides.position ?? 7, monumentCanvasFromEnv());
  const text = overrides.text ?? "The future needs people willing to believe it deserves one.";
  return {
    id: "monument-7",
    monumentNumber: plot.position,
    position: plot.position,
    x: plot.x,
    y: plot.y,
    width: plot.width,
    height: plot.height,
    sentenceSnapshot: overrides.sentenceSnapshot ?? text,
    eventId: "event-7",
    editionNumber: 7,
    themeTitle: "WALL OF HOPE",
    themeSlug: "hope",
    themeQuestion: "If you could leave one sentence about hope behind, what would it be?",
    themeDescription: null,
    startsAt: "2026-08-08T00:00:00.000Z",
    endsAt: "2026-08-09T00:00:00.000Z",
    messageId: "msg-4291",
    originalPublicNumber: 4291,
    text,
    isRemoved: false,
    finalReactionCount: 491283,
    finalRank: 1,
    winningMargin: 10281,
    wallTotalMessages: 428193,
    wallTotalReactions: 19284921,
    publishedAt: "2026-08-08T12:00:00.000Z",
    sealedAt: "2026-08-09T00:00:05.000Z",
    archiveHash: "a".repeat(64),
    merkleRoot: "b".repeat(64),
    ...overrides,
  };
}
