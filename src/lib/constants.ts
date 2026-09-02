import { BRAND } from "@/lib/brand";

export const APP_NAME = BRAND.wordmark;
export const TAGLINE = "ONE DAY. ONE DOLLAR. ONE SENTENCE.";
export const ARCHIVAL_TAGLINE = "ONE DAY. ONE DOLLAR. ONE SENTENCE.";
export const ARCHIVAL_REMOVAL_TEXT = "Message removed under archive policy.";
export const REVIEW_HOLD_TEXT = "This sentence is under review.";
export const HERO_PITCH = [
  "For 24 hours, one wall is open.",
  "Anyone can read it.",
  "$1 writes one sentence.",
  "When the clock hits zero, no one can add another word.",
] as const;

export const SUPPORTING_COPY = HERO_PITCH.join(" ");

export const MESSAGE_MAX_GRAPHEMES = 140;
export const MESSAGE_DB_MAX_CHARS = 560;
export const PRICE_USDC = "1.00";
export const PRICE_USDC_ATOMIC = BigInt(1_000_000);
export const CURRENCY = "USDC";
export const PAYMENT_INTENT_TTL_SECONDS = 15 * 60;
export const REACTION_TYPE = "fire";

export const USDC_ADDRESSES = {
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
} as const;

export const CHAIN_IDS = {
  base: 8453,
  "base-sepolia": 84532,
} as const;

export const DEFAULT_RPC_URLS = {
  base: "https://mainnet.base.org",
  "base-sepolia": "https://sepolia.base.org",
} as const;

export type BaseNetwork = keyof typeof USDC_ADDRESSES;

export const CANONICAL_SORTS = ["rising", "hot", "new", "random", "gems", "final"] as const;
export type MessageSort = (typeof CANONICAL_SORTS)[number];
export const SORTS = [...CANONICAL_SORTS, "trending", "hour"] as const;
export type AcceptedSort = (typeof SORTS)[number];

export function resolveMessageSort(sort: string | undefined): MessageSort {
  if (sort === "trending" || sort === "hour" || sort === "rising") return "rising";
  if (sort === "hot" || sort === "new" || sort === "random" || sort === "gems" || sort === "final") {
    return sort;
  }
  return "rising";
}

export const REPORT_CATEGORIES = [
  "hate",
  "harassment",
  "sexual",
  "spam",
  "illegal",
  "other",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const FEEDBACK_CATEGORIES = ["product", "bug", "other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  product: "The site",
  bug: "Something broken",
  other: "Other",
};

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  hate: "Hate",
  harassment: "Harassment",
  sexual: "Sexual content",
  spam: "Spam",
  illegal: "Illegal content",
  other: "Other",
};

export const MODERATION_REASON_CODES = [
  "hate",
  "harassment",
  "sexual",
  "spam",
  "illegal",
  "doxxing",
  "other",
] as const;
export type ModerationReasonCode = (typeof MODERATION_REASON_CODES)[number];

export const MODERATION_REASON_LABELS: Record<ModerationReasonCode, string> = {
  hate: "Hate",
  harassment: "Harassment",
  sexual: "Sexual content",
  spam: "Spam",
  illegal: "Illegal content",
  doxxing: "Doxxing / private data",
  other: "Other",
};
