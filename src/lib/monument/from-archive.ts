import { ARCHIVAL_REMOVAL_TEXT } from "@/lib/constants";
import { monumentCanvasFromEnv, plotForPosition } from "@/lib/monument/canvas";
import { winningMargin } from "@/lib/monument/policy";
import { compareHot, isLivingForVictor } from "@/lib/ranking";
import type { MonumentEntry } from "@/lib/monument/types";
import type { EventSnapshot, PublicMessage } from "@/lib/types";
import { editionNumberOf, wallTitle } from "@/lib/utils";

export function monumentFromSealedWall(input: {
  monumentNumber: number;
  event: EventSnapshot;
  messages: PublicMessage[];
}): MonumentEntry | null {
  const living = input.messages.filter(isLivingForVictor);
  const winner =
    input.messages.find((message) => message.finalRank === 1) ??
    [...living].sort(compareHot)[0] ??
    null;
  if (!winner) return null;
  const plot = plotForPosition(input.monumentNumber, monumentCanvasFromEnv());
  const snapshot = winner.isRemoved ? ARCHIVAL_REMOVAL_TEXT : winner.text;
  const second =
    input.messages.find((message) => message.finalRank === 2) ??
    living.filter((message) => message.id !== winner.id).sort(compareHot)[0];
  return {
    id: `monument-${input.monumentNumber}`,
    monumentNumber: input.monumentNumber,
    position: plot.position,
    x: plot.x,
    y: plot.y,
    width: plot.width,
    height: plot.height,
    sentenceSnapshot: snapshot,
    eventId: input.event.id,
    editionNumber: editionNumberOf(input.event),
    themeTitle: wallTitle(input.event),
    themeSlug: input.event.themeSlug ?? null,
    themeQuestion: input.event.themeQuestion ?? null,
    themeDescription: input.event.themeDescription ?? null,
    startsAt: input.event.startsAt,
    endsAt: input.event.endsAt,
    messageId: winner.id,
    originalPublicNumber: winner.publicNumber,
    text: winner.isRemoved ? ARCHIVAL_REMOVAL_TEXT : winner.text,
    isRemoved: winner.isRemoved,
    finalReactionCount: winner.reactionCount,
    finalRank: 1,
    winningMargin: winningMargin(winner.reactionCount, second?.reactionCount),
    wallTotalMessages: input.event.totalMessages,
    wallTotalReactions: input.event.totalReactions,
    publishedAt: winner.publishedAt,
    sealedAt: input.event.finalizedAt ?? input.event.archivedAt ?? input.event.endsAt,
    archiveHash: input.event.archiveHash ?? null,
    merkleRoot: input.event.merkleRoot ?? null,
  };
}
