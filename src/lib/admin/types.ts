import type { EventSnapshot } from "@/lib/types";
import type { AdminHealth } from "@/lib/admin/sanitize";
import type { AdminOpsAuditRow, EventOpsControls } from "@/lib/ops/controls";

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
  createdAt: string;
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
  editionNumber: number;
  themeSlug: string | null;
  themeQuestion: string | null;
  themeDescription: string | null;
  monumentNumber: number | null;
  archiveHash: string | null;
  merkleRoot: string | null;
  archiveUri: string | null;
  proofTx: string | null;
  windowMinutes: number;
  remainingMinutes: number;
  publishEnabled: boolean;
  reactEnabled: boolean;
  strictBot: boolean;
};

export type AdminOpsSnapshot = {
  event: {
    state: EventSnapshot["phase"];
    startsAt: string;
    endsAt: string;
    remainingMs: number;
    remainingLabel: string;
  };
  traffic: {
    pageViewsLast15m: number | null;
    requestsLast15m: number | null;
    errorRate: number | null;
    activeViewers: number | null;
    note: string;
  };
  messages: {
    total: number;
    perMinute: number | null;
    moderationFailures: number;
  };
  payments: {
    intents: number;
    successful: number;
    failed: number;
    pending: number;
    duplicateReplay: number;
  };
  reactions: {
    total: number;
    perMinute: number | null;
    suspiciousSpikes: number;
  };
  system: {
    supabase: string;
    payments: string;
    realtime: string;
    archivePrep: string;
  };
  moderation: {
    reports: number;
    pendingReviews: number;
    removals: number;
  };
  controls: EventOpsControls;
};

export type AdminEditionCard = {
  editionNumber: number;
  title: string;
  startsAt: string;
  endsAt: string;
  totalMessages: number;
  totalReactions: number;
  archiveHash: string | null;
  merkleRoot: string | null;
};

export type AdminFeedbackRow = {
  id: string;
  body: string;
  category: string;
  email: string | null;
  createdAt: string;
};

export type AdminReactionSignal = {
  kind: string;
  subject: string;
  count: number;
  createdAt: string;
  note: string;
};

export type AdminOverview = {
  config: AdminConfigPreview;
  totals: { messages: number; reactions: number; usdc: number };
  recentFailures: { reasonCode: string; createdAt: string; transactionHash: string | null }[];
  recentPayments: AdminPaymentHit[];
  openReports: AdminReportRow[];
  flaggedMessages: { id: string; publicNumber: number; moderationStatus: string }[];
  reviewRanks: AdminMessageHit[];
  audit: AdminAuditRow[];
  health: AdminHealth;
  simulation: boolean;
  editions: AdminEditionCard[];
  feedback: AdminFeedbackRow[];
  claimAttempts: { publicNumber: number; outcome: string; createdAt: string }[];
  reactionSignals: AdminReactionSignal[];
  ops: AdminOpsSnapshot;
  opsAudit: AdminOpsAuditRow[];
};

export function emptyAdminOps(config: AdminConfigPreview): AdminOpsSnapshot {
  return {
    event: {
      state: config.phase,
      startsAt: config.startsAt,
      endsAt: config.endsAt,
      remainingMs: Math.max(0, Date.parse(config.endsAt) - Date.now()),
      remainingLabel: `${config.remainingMinutes} min`,
    },
    traffic: {
      pageViewsLast15m: null,
      requestsLast15m: null,
      errorRate: null,
      activeViewers: null,
      note: "Unique viewers are not counted.",
    },
    messages: {
      total: config.totalMessages,
      perMinute: null,
      moderationFailures: 0,
    },
    payments: {
      intents: 0,
      successful: 0,
      failed: 0,
      pending: 0,
      duplicateReplay: 0,
    },
    reactions: {
      total: config.totalReactions,
      perMinute: null,
      suspiciousSpikes: 0,
    },
    system: {
      supabase: "unknown",
      payments: "unknown",
      realtime: "unknown",
      archivePrep: config.archiveHash && config.merkleRoot ? "sealed" : "not yet",
    },
    moderation: {
      reports: 0,
      pendingReviews: 0,
      removals: 0,
    },
    controls: {
      publishEnabled: config.publishEnabled,
      reactEnabled: config.reactEnabled,
      strictBot: config.strictBot,
    },
  };
}
