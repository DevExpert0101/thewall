import type { EventSnapshot } from "@/lib/types";
import type { AdminHealth } from "@/lib/admin/sanitize";

export type AdminMessageHit = {
  id: string;
  publicNumber: number;
  text: string;
  reactionCount: number;
  publishedAt: string;
  removedAt: string | null;
  moderationStatus: string;
  removalReasonCode: string | null;
};

export type AdminReportRow = {
  id: string;
  messageId: string;
  publicNumber: number | null;
  category: string;
  detail: string | null;
  status: string;
  createdAt: string;
};

export type AdminAuditRow = {
  id: string;
  messageId: string;
  publicNumber: number | null;
  action: string;
  reason: string;
  administratorEmail: string;
  createdAt: string;
};

export type AdminPaymentHit = {
  transactionHash: string;
  amount: string;
  currency: string;
  network: string;
  status: string;
  verifiedAt: string | null;
  sender: string;
  recipient: string;
  intentStatus: string | null;
  publicNumber: number | null;
};

export type AdminConfigPreview = {
  title: string;
  slug: string;
  phase: EventSnapshot["phase"];
  startsAt: string;
  endsAt: string;
  archivedAt: string | null;
  finalizedAt: string | null;
  network: string;
  treasuryAddress: string | null;
  priceUsdc: string;
  totalMessages: number;
  totalReactions: number;
};

export type AdminOverview = {
  config: AdminConfigPreview;
  totals: { messages: number; reactions: number; usdc: number };
  recentFailures: { reasonCode: string; createdAt: string; transactionHash: string | null }[];
  openReports: AdminReportRow[];
  flaggedMessages: { id: string; publicNumber: number; moderationStatus: string }[];
  audit: AdminAuditRow[];
  health: AdminHealth;
};
