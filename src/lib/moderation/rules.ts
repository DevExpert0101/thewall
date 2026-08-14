import type { ModerationProvider, ModerationResult } from "@/lib/moderation/types";

const URL_RE = /https?:\/\/[^\s]+/gi;
const REPEATED_CHAR = /(.)\1{39,}/u;

const BLOCK_PHRASES = [
  "child sexual",
  "child porn",
  "csam",
];

export class RuleBasedModerationProvider implements ModerationProvider {
  readonly name = "rules-v1";

  async review(input: { text: string }): Promise<ModerationResult> {
    const text = input.text;
    const lower = text.toLowerCase();

    for (const phrase of BLOCK_PHRASES) {
      if (lower.includes(phrase)) {
        return {
          status: "rejected",
          reasonCode: "forbidden_content",
          provider: this.name,
        };
      }
    }

    if (REPEATED_CHAR.test(text)) {
      return {
        status: "rejected",
        reasonCode: "spam_repetition",
        provider: this.name,
      };
    }

    const urls = text.match(URL_RE) ?? [];
    if (urls.length >= 3) {
      return {
        status: "rejected",
        reasonCode: "link_spam",
        provider: this.name,
      };
    }

    if (urls.length > 0) {
      return {
        status: "flagged",
        reasonCode: "contains_url",
        provider: this.name,
      };
    }

    return { status: "approved", reasonCode: null, provider: this.name };
  }
}

let provider: ModerationProvider = new RuleBasedModerationProvider();

export function getModerationProvider(): ModerationProvider {
  return provider;
}

export function setModerationProvider(next: ModerationProvider): void {
  provider = next;
}
