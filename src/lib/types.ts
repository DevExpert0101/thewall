export type PublicMessage = {
  id: string;
  eventId: string;
  publicNumber: number;
  text: string;
  isRemoved: boolean;
  reactionCount: number;
  publishedAt: string;
  finalRank: number | null;
};

export type EventSnapshot = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  archivedAt: string | null;
  finalizedAt: string | null;
  phase: "upcoming" | "live" | "finalizing" | "archived";
  serverNow: string;
  totalMessages: number;
  totalReactions: number;
  treasuryAddress: string | null;
  network: string;
  priceUsdc: string;
  editionNumber?: number;
  archiveHash?: string | null;
  merkleRoot?: string | null;
  archiveUri?: string | null;
  proofTx?: string | null;
};

export type EditionHighlight = {
  publicNumber: number;
  text: string;
  isRemoved: boolean;
  reactionCount: number;
  finalRank: number | null;
  publishedAt: string;
};

export type EditionSummary = {
  id: string;
  editionNumber: number;
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  finalizedAt: string | null;
  totalMessages: number;
  totalReactions: number;
  archiveHash: string | null;
  merkleRoot: string | null;
  archiveUri: string | null;
  proofTx: string | null;
  winning: EditionHighlight | null;
};

export type EditionRecords = {
  editionNumber: number;
  first: EditionHighlight | null;
  last: EditionHighlight | null;
  winning: EditionHighlight | null;
  mostReacted: EditionHighlight | null;
  milestone100000: EditionHighlight | null;
  milestone250000: EditionHighlight | null;
  totalMessages: number;
  totalReactions: number;
  durationHours: number;
  peakMessagesPerMinute: number;
};

export type AllTimeRecords = {
  mostMessages: { editionNumber: number; totalMessages: number } | null;
  mostReactions: { editionNumber: number; totalReactions: number } | null;
  mostFireOnMessage: {
    editionNumber: number;
    publicNumber: number;
    reactionCount: number;
  } | null;
  largestFinalMinute: { editionNumber: number; peakMessagesPerMinute: number } | null;
};

export type CertificatePayload = {
  publicNumber: number;
  text: string;
  reactionCount: number;
  finalRank: number | null;
  publishedAt: string;
  eventTitle: string;
  eventDate: string;
  tagline: string;
  editionNumber?: number;
  totalMessages?: number;
};
