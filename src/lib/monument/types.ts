import type { MonumentCanvasGeometry, MonumentPlot } from "@/lib/monument/canvas";

export type { MonumentCanvasGeometry, MonumentPlot };

export type MonumentEntry = {
  id: string;
  monumentNumber: number;
  position: number;
  x: number;
  y: number;
  width: number;
  height: number;
  sentenceSnapshot: string;
  eventId: string;
  editionNumber: number;
  themeTitle: string;
  themeSlug: string | null;
  themeQuestion: string | null;
  themeDescription: string | null;
  startsAt: string;
  endsAt: string;
  messageId: string;
  originalPublicNumber: number;
  text: string;
  isRemoved: boolean;
  finalReactionCount: number;
  finalRank: 1;
  winningMargin: number;
  wallTotalMessages: number;
  wallTotalReactions: number;
  publishedAt: string;
  sealedAt: string;
  archiveHash: string | null;
  merkleRoot: string | null;
};

export type MonumentCatalog = {
  entries: MonumentEntry[];
  sealedCount: number;
  capacity: number | null;
  canvas: MonumentCanvasGeometry;
};

export type VictorRaceLeader = {
  publicNumber: number;
  text: string;
  isRemoved: boolean;
  reactionCount: number;
  publishedAt: string;
};

export type VictorRace = {
  leaders: VictorRaceLeader[];
  provisional: true;
};
