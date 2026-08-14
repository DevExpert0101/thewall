export const APP_NAME = "THE WALL";
export const TAGLINE = "ONE DAY. ONE DOLLAR. ONE SENTENCE FOREVER.";
export const ARCHIVAL_TAGLINE = "ONE DAY. ONE DOLLAR. ONE SENTENCE FOREVER.";
export const ARCHIVAL_REMOVAL_TEXT = "Message removed under archive policy.";
export const SUPPORTING_COPY =
  "For 24 hours, the world gets one anonymous wall. Anyone can read it. One dollar buys one 140-character message. When the clock reaches zero, no one can add another word.";

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

export const SORTS = ["trending", "hot", "new", "random", "hour"] as const;
export type MessageSort = (typeof SORTS)[number];

export const REPORT_CATEGORIES = [
  "hate",
  "harassment",
  "sexual",
  "spam",
  "illegal",
  "other",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

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
