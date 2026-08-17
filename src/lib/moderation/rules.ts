import { foldForModeration } from "@/lib/moderation/fold";
import type { ModerationDecision, ModerationProvider, ModerationResult, ModerationStatus } from "@/lib/moderation/types";

const URL_RE = /https?:\/\/[^\s]+/gi;
const REPEATED_CHAR = /(.)\1{39,}/u;
const REPEATED_WORD = /\b(\S{2,})\b(?:\s+\1){7,}/iu;
const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;
const PHONE_RE = /\b(?:\+?\d{1,3}[-.\s])?(?:\(?\d{3}\)?[-.\s])\d{3}[-.\s]\d{4}\b/;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/;
const WALLET_RE = /\b0x[a-f0-9]{40}\b/i;
const IPV4_RE =
  /\b(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}\b/;
const DANGEROUS_URL =
  /(?:javascript:|data:|file:|[\w-]+\.(?:exe|apk|bat|cmd|scr)\b|https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?:[:/]|$))/i;

const BLOCK_PHRASES = [
  "child sexual",
  "child porn",
  "csam",
  "child pornography",
  "underage sex",
  "sexual content involving a minor",
  "sexual content involving minors",
];

const THREAT_PHRASES = [
  "i will kill you",
  "i'm going to kill you",
  "i am going to kill you",
  "i will shoot you",
  "bomb the school",
  "bomb the hospital",
];

const HARASS_PHRASES = ["kill yourself", "you should die", "i will find you and"];

const ILLEGAL_PHRASES = ["hitman for hire", "buy stolen cards", "buy stolen ids"];

function result(
  status: ModerationStatus,
  decision: ModerationDecision,
  reasonCode: string | null,
): ModerationResult {
  return { status, decision, reasonCode, provider: PROVIDER_NAME };
}

function reject(reasonCode: string): ModerationResult {
  return result("rejected", "rejected", reasonCode);
}

function flag(reasonCode: string): ModerationResult {
  return result("flagged", "review_required", reasonCode);
}

function allow(): ModerationResult {
  return result("approved", "allowed", null);
}

function containsPhrase(folded: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => folded.includes(phrase));
}

export const PROVIDER_NAME = "rules-v1";

/** Sync review used before a wallet opens and again before publish. */
export function evaluateModeration(text: string): ModerationResult {
  const folded = foldForModeration(text);

  if (containsPhrase(folded, BLOCK_PHRASES)) {
    return reject("forbidden_content");
  }
  if (containsPhrase(folded, THREAT_PHRASES)) {
    return reject("threat");
  }
  if (containsPhrase(folded, ILLEGAL_PHRASES)) {
    return reject("illegal");
  }
  if (containsPhrase(folded, HARASS_PHRASES)) {
    return reject("harassment");
  }
  if (EMAIL_RE.test(folded) || PHONE_RE.test(folded) || SSN_RE.test(folded)) {
    return reject("personal_information");
  }
  if (WALLET_RE.test(folded) || IPV4_RE.test(folded)) {
    return reject("personal_information");
  }
  if (REPEATED_CHAR.test(text) || REPEATED_WORD.test(folded)) {
    return reject("spam_repetition");
  }
  if (DANGEROUS_URL.test(folded)) {
    return reject("malicious_link");
  }

  const urls = text.match(URL_RE) ?? [];
  if (urls.length >= 3) {
    return reject("link_spam");
  }
  if (urls.length > 0) {
    return flag("contains_url");
  }

  return allow();
}

export class RuleBasedModerationProvider implements ModerationProvider {
  readonly name = PROVIDER_NAME;

  async review(input: { text: string }): Promise<ModerationResult> {
    return evaluateModeration(input.text);
  }
}

let provider: ModerationProvider = new RuleBasedModerationProvider();

export function getModerationProvider(): ModerationProvider {
  return provider;
}

export function setModerationProvider(next: ModerationProvider): void {
  provider = next;
}
