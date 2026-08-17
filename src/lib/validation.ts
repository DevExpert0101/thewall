import { z } from "zod";
import {
  FEEDBACK_CATEGORIES,
  MESSAGE_MAX_GRAPHEMES,
  MODERATION_REASON_CODES,
  REPORT_CATEGORIES,
  resolveMessageSort,
  SORTS,
} from "@/lib/constants";
import { isOwnershipSecret } from "@/lib/ownership/wall-key";

export const composeSchema = z.object({
  message: z.string().min(1).max(MESSAGE_MAX_GRAPHEMES * 8),
  turnstileToken: z.string().min(10),
});

export const preflightSchema = z.object({
  message: z.string().min(1).max(MESSAGE_MAX_GRAPHEMES * 8),
  turnstileToken: z.string().min(10).optional(),
});

export const verifyPaymentSchema = z.object({
  intentId: z.string().uuid(),
  transactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
}).transform((value) => ({
  intentId: value.intentId,
  transactionHash: value.transactionHash.toLowerCase(),
}));

export const reactSchema = z.object({
  messageId: z.string().uuid(),
  idempotencyKey: z.string().uuid().optional(),
  turnstileToken: z.string().min(10).optional(),
});

export const reportSchema = z.object({
  messageId: z.string().uuid(),
  category: z.enum(REPORT_CATEGORIES),
  detail: z.string().max(500).optional(),
});

export const feedbackSchema = z.object({
  body: z.string().trim().min(8).max(800),
  category: z.enum(FEEDBACK_CATEGORIES).default("product"),
  email: z
    .string()
    .trim()
    .email()
    .max(200)
    .optional()
    .or(z.literal("")),
});

export const messagesQuerySchema = z.object({
  sort: z.enum(SORTS).default("rising").transform(resolveMessageSort),
  cursor: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  q: z.string().max(140).optional(),
  salt: z.string().max(64).optional(),
  edition: z.coerce.number().int().min(1).max(999999).optional(),
  mix: z.enum(["1", "0"]).optional(),
});

export const randomMessagesQuerySchema = z.object({
  exclude: z.string().max(400).optional(),
  count: z.coerce.number().int().min(1).max(8).default(2),
  edition: z.coerce.number().int().min(1).max(999999).optional(),
});

export const pulseQuerySchema = z.object({
  ids: z
    .string()
    .max(2000)
    .transform((value) =>
      value
        .split(",")
        .map((id) => id.trim())
        .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        .slice(0, 48),
    ),
  eventId: z.string().uuid().optional(),
});

export const certificateQuerySchema = z.object({
  token: z.string().min(8).max(80).refine((value) => isOwnershipSecret(value.trim()), {
    message: "Invalid Wall Key",
  }),
});

export const claimSchema = z.object({
  publicNumber: z.coerce.number().int().min(1).max(1_000_000),
  wallKey: z.string().min(8).max(80),
});

export const winnerDeliverySchema = z
  .object({
    contactEmail: z.string().email().max(200).optional(),
    payoutAddress: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/)
      .optional(),
    legalAcknowledged: z.literal(true),
  })
  .refine((value) => Boolean(value.contactEmail || value.payoutAddress), {
    message: "Enter a contact email or a payout wallet.",
  });

export const analyticsSchema = z.object({
  name: z.enum([
    "page_view",
    "compose_started",
    "payment_initiated",
    "payment_verified",
    "message_published",
    "reaction",
    "share",
    "certificate_viewed",
  ]),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const adminModerateSchema = z.object({
  messageId: z.string().uuid(),
  action: z.enum(["remove", "restore"]),
  reason: z.enum(MODERATION_REASON_CODES),
  note: z.string().max(400).optional(),
  confirm: z.literal(true),
  confirmText: z.string().min(1).max(32),
});

export const adminReportReviewSchema = z.object({
  reportId: z.string().uuid(),
  reason: z.enum(MODERATION_REASON_CODES),
  note: z.string().max(400).optional(),
  confirm: z.literal(true),
  confirmText: z.string().min(1).max(32),
});

export const adminEventSchema = z.object({
  action: z.enum(["save", "start", "finish", "openNext", "reset", "ops"]).optional().default("save"),
  title: z.string().min(1).max(80).optional(),
  themeSlug: z.string().max(80).optional(),
  themeQuestion: z.string().max(280).optional(),
  themeDescription: z.string().max(800).optional(),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
  remainingMinutes: z.number().int().min(1).max(14 * 24 * 60).optional(),
  durationMinutes: z.number().int().min(1).max(14 * 24 * 60).optional(),
  publishEnabled: z.boolean().optional(),
  reactEnabled: z.boolean().optional(),
  strictBot: z.boolean().optional(),
  confirmHistoricalEdit: z.boolean().optional(),
  confirm: z.boolean().optional(),
  confirmText: z.string().max(32).optional(),
});

export const adminSearchSchema = z.object({
  q: z.string().min(1).max(200),
});

export const adminLoginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});
