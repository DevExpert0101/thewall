// Automatic pre-publication moderation for The Wall.
//
// Pipeline order matches the production risk profile — cheap deterministic
// gates first (fast fail, no network), AI moderation last as the final pass.
//
//   length → spam → pii → url → profanity/adult → threat/harassment → AI
//
// The deterministic rules are deliberately conservative: this is an anonymous,
// paid wall, and the cost of a false positive is a rejected submission (no
// payment is ever created for a rejected message). The AI pass only runs when
// OPENAI_API_KEY is set and fails open if the service is unreachable — the
// deterministic rules remain the baseline.

export type ModerationReason =
  | "length"
  | "spam"
  | "pii"
  | "url"
  | "profanity"
  | "adult"
  | "threat"
  | "harassment"
  | "ai";

export interface ModerationResult {
  approved: boolean;
  reasons: ModerationReason[];
}

const MAX_LENGTH = 140;

// ---- Normalization ---------------------------------------------------------
// Lowercase, decode common leetspeak so "h4te" matches "hate", strip
// separators so "f.u.c.k" matches "fuck", collapse whitespace.
const LEET: Record<string, string> = {
  "4": "a",
  "@": "a",
  "8": "b",
  "3": "e",
  "9": "g",
  "1": "i",
  "!": "i",
  "0": "o",
  "$": "s",
  "5": "s",
  "7": "t",
  "+": "t",
};

function normalize(input: string): string {
  const lower = input.toLowerCase();
  let out = "";
  for (const ch of lower) {
    out += LEET[ch] ?? ch;
  }
  return out.replace(/[^a-z0-9]+/g, " ").trim();
}

// ---- Blocklists ------------------------------------------------------------

const PROFANITY = [
  "fuck", "fucking", "fucker", "fucked", "fuck you", "shit", "shitty",
  "bitch", "bastard", "asshole", "motherfucker", "mf", "cunt", "douchebag",
  "piss off", "bullshit", "dumbass", "wanker", "twat", "cock", "dickhead",
  "piece of shit", "prick",
];

// Hate slurs — the wall is anonymous; a targeted slur is harassment.
const SLURS = [
  "nigger", "nigga", "faggot", "fag", "dyke", "tranny", "retard", "spic",
  "chink", "kike", "wetback", "gook", "cracker", "white trash", "jew",
  "paki", "raghead", "sand nigger",
];

const ADULT = [
  "porn", "porno", "pornhub", "onlyfans", "hentai", "milf", "nude",
  "naked", "sex", "sexy", "sexual", "nsfw", "strip", "stripper",
  "erotic", "orgasm", "anal", "blowjob", "boobs", "tits", "pussy",
  "nipple", "masturbat", "bondage", "escort", "squirt", "cum", "horny",
  "hookup", "dildo", "vibrator", "fetish", "kink", "slut",
];

const THREATS = [
  "kill yourself", "kill urself", "kys", "go die", "die in a fire",
  "you should die", "i will kill", "i'll kill", "im going to kill",
  "i'm going to kill", "i will murder", "i'll murder", "i will rape",
  "i'll rape", "i will shoot", "i'll shoot", "gonna shoot up",
  "i know where you live", "i know your address", "im coming for you",
  "i'm coming for you", "i'll find you", "i will find you",
  "slit your throat", "cut your throat", "hang yourself", "rape you",
  "molest", "murder you", "watch your back", "burn your house",
  "dox you", "ill dox", "i will dox",
];

const SCAM = [
  "free bitcoin", "free btc", "claim reward", "airdrop", "guaranteed profit",
  "double your", "invest", "private key", "passphrase", "send me",
  "dm me", "message me", "cash app", "paypal.me", "cashapp", "venmo",
  "gift card", "won a prize", "you won", "click the link", "click here",
  "join telegram", "join my telegram", "hit me up", "sign up",
  "referral", "crypto signals", "pump and dump", "fomo", "get rich",
  "passive income", "withdrawal",
];

const ADULT_AND_PROFANITY = new Set([...PROFANITY, ...SLURS, ...ADULT]);

function containsAny(normalized: string, terms: readonly string[]): boolean {
  return terms.some((t) => normalized.includes(t));
}

// ---- Pattern gates ---------------------------------------------------------

const URL_RE =
  /https?:\/\/|www\.|\b[a-z0-9][a-z0-9-]{1,61}\.(com|net|org|io|co|xyz|info|me|ru|gg|link|click|biz|ws|tv|app|dev|site|online)\b/i;

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE =
  /(?:\+?\d{1,3}[\s().-]*)?(?:\(\d{2,4}\)[\s().-]*)?\d{3}[\s().-]*\d{3,4}(?:[\s().-]*\d{2,4})?/;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/;
const IP_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const CARD_RE = /\b(?:\d{4}[ -]?){3}\d{4}\b/;
const CRYPTO_RE =
  /\b(?:bc1[a-z0-9]{8,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|0x[a-fA-F0-9]{40}|T[a-zA-Z0-9]{33}|L[a-km-z1-9]{26,33}|D[a-km-z1-9]{26,33})\b/;

const EMOJI = /[\p{Extended_Pictographic}]/gu;
const REPEAT_CHAR = /(.)\1{9,}/;
const REPEAT_TOKEN = /\b(\w{3,})\b(?:[\s,]+(?:\1\b)){3,}/;
const VOWELS = /[aeiouy]/gi;
const LETTERS = /[a-z]/gi;

function emojiCount(content: string): number {
  return content.match(EMOJI)?.length ?? 0;
}

// ---- The pipeline ----------------------------------------------------------

function deterministicCheck(content: string): ModerationReason[] {
  const reasons: ModerationReason[] = [];

  // length — hard bound already enforced by the schema, cheap to check here.
  if (content.trim().length < 1 || content.length > MAX_LENGTH) {
    reasons.push("length");
  }

  // url — external links are a spam/traffic vector on a paid wall.
  if (URL_RE.test(content)) reasons.push("url");

  // pii — personal data of third parties has no place here.
  if (
    EMAIL_RE.test(content) ||
    SSN_RE.test(content) ||
    IP_RE.test(content) ||
    CARD_RE.test(content) ||
    CRYPTO_RE.test(content)
  ) {
    reasons.push("pii");
  }
  // Phone numbers need enough digits to be credible; skip "000-000-0000".
  const digits = content.replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 15 && PHONE_RE.test(content)) {
    reasons.push("pii");
  }

  const normalized = normalize(content);

  // profanity + adult — shared vocabulary, matched after normalization.
  if (containsAny(normalized, [...ADULT_AND_PROFANITY])) {
    const terms = normalized.split(" ");
    const adult = terms.some((t) => ADULT.includes(t));
    reasons.push(adult ? "adult" : "profanity");
  }

  // threat / harassment — directed harm or doxxing.
  if (containsAny(normalized, THREATS)) {
    reasons.push(normalized.includes("kill yourself") ||
      normalized.includes("kill urself") ||
      normalized.includes("kys") ||
      normalized.includes("go die") ||
      normalized.includes("you should die") ||
      normalized.includes("hang yourself")
      ? "harassment"
      : "threat");
  }
  if (containsAny(normalized, SLURS)) reasons.push("harassment");

  // spam — repetition, gibberish, emoji floods, scam pitches.
  if (
    REPEAT_CHAR.test(content) ||
    REPEAT_TOKEN.test(content) ||
    emojiCount(content) > 8 ||
    containsAny(normalized, SCAM)
  ) {
    reasons.push("spam");
  }
  const letters = content.match(LETTERS)?.length ?? 0;
  const vowels = content.match(VOWELS)?.length ?? 0;
  if (letters > 12 && vowels / letters < 0.12) reasons.push("spam");
  const upper = content.replace(/[^A-Z]/g, "").length;
  if (content.length >= 15 && upper / content.length > 0.7) reasons.push("spam");

  return reasons;
}

async function aiCheck(content: string): Promise<boolean> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: content,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { results?: Array<{ flagged?: boolean }> };
    return data.results?.[0]?.flagged === true;
  } catch {
    // Fail open: the deterministic rules are the baseline, an AI outage must
    // not take the whole wall down.
    return false;
  }
}

export async function runModeration(
  content: string,
): Promise<ModerationResult> {
  const reasons = deterministicCheck(content);
  if (reasons.length > 0) {
    return { approved: false, reasons };
  }

  if (await aiCheck(content)) {
    return { approved: false, reasons: ["ai"] };
  }

  return { approved: true, reasons: [] };
}

// Short, human-readable copy for a rejected message.
export function moderationMessage(reasons: ModerationReason[]): string {
  const labels: Partial<Record<ModerationReason, string>> = {
    length: "over the length limit",
    spam: "looked like spam",
    pii: "contained personal information",
    url: "contained a link",
    profanity: "contained profanity",
    adult: "contained adult content",
    threat: "contained threatening language",
    harassment: "contained harassment",
    ai: "didn't pass AI moderation",
  };
  const unique = [...new Set(reasons)];
  const text = unique.map((r) => labels[r] ?? r).join(" and ");
  return `This message was flagged by automatic moderation (${text}). Nothing was charged.`;
}
