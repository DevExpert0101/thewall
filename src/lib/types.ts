export type PublicMessage = {
  id: string;
  eventId: string;
  publicNumber: number;
  text: string;
  isRemoved: boolean;
  isHeld?: boolean;
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
  reviewClosedAt?: string | null;
  phase: "upcoming" | "live" | "finalizing" | "archived";
  serverNow: string;
  totalMessages: number;
  totalReactions: number;
  treasuryAddress: string | null;
  network: string;
  priceUsdc: string;
  editionNumber?: number;
  themeSlug?: string | null;
  themeQuestion?: string | null;
  themeDescription?: string | null;
  monumentNumber?: number | null;
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
  monumentNumber?: number | null;
  themeQuestion?: string | null;
};

export type FirePaceRecord = {
  publicNumber: number;
  threshold: number;
  elapsedMs: number;
};

export type EditionRecords = {
  editionNumber: number;
  first: EditionHighlight | null;
  last: EditionHighlight | null;
  winning: EditionHighlight | null;
  mostReacted: EditionHighlight | null;
  milestone100000: EditionHighlight | null;
  milestone250000: EditionHighlight | null;
  milestones: Array<{
    kind: "message" | "fire";
    value: number;
    publicNumber: number | null;
  }>;
  totalMessages: number;
  totalReactions: number;
  durationHours: number;
  peakMessagesPerMinute: number;
  peakReactionsPerMinute: number | null;
  mostReactionsInOneHour: number | null;
  fastestTo100: FirePaceRecord | null;
  fastestTo1000: FirePaceRecord | null;
  fastestTo10000: FirePaceRecord | null;
  top100: EditionHighlight[];
  fireLedgerComplete: boolean;
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
  largestReactionMinute: { editionNumber: number; peakReactionsPerMinute: number } | null;
  largestReactionHour: { editionNumber: number; mostReactionsInOneHour: number } | null;
  fastestTo100: (FirePaceRecord & { editionNumber: number }) | null;
  fastestTo1000: (FirePaceRecord & { editionNumber: number }) | null;
  fastestTo10000: (FirePaceRecord & { editionNumber: number }) | null;
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
  archiveHash?: string | null;
  merkleRoot?: string | null;
  proofTx?: string | null;
};
