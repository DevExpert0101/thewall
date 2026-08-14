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
};
