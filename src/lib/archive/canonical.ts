import { sha256Hex } from "@/lib/crypto";
import type { EditionRecords, EventSnapshot, PublicMessage } from "@/lib/types";
import { editionNumberOf } from "@/lib/utils";
import { recordsFromMessages } from "@/lib/archive/records";

export const ARCHIVE_SCHEMA = "thewall.archive.v1";

export const CANONICAL_MESSAGE_KEYS = [
  "finalRank",
  "isRemoved",
  "publicNumber",
  "publishedAt",
  "reactionCount",
  "text",
] as const;

/** Fields that must never appear in the sealed public dataset. */
export const FORBIDDEN_ARCHIVE_KEYS = [
  "wallet",
  "walletAddress",
  "claimKey",
  "claimToken",
  "ownershipHash",
  "ownershipToken",
  "wallKey",
  "ip",
  "ipAddress",
  "userId",
  "user_id",
  "sessionId",
  "moderationNote",
  "moderationReason",
  "internalNote",
  "paymentId",
  "paymentTx",
  "transactionHash",
  "treasuryAddress",
] as const;

export type CanonicalMessage = {
  publicNumber: number;
  text: string;
  isRemoved: boolean;
  reactionCount: number;
  finalRank: number;
  publishedAt: string;
};

export type CanonicalArchive = {
  schema: typeof ARCHIVE_SCHEMA;
  edition: number;
  title: string;
  startsAt: string;
  endsAt: string;
  finalizedAt: string;
  totalMessages: number;
  totalReactions: number;
  winningPublicNumber: number | null;
  merkleRoot: string;
  messages: CanonicalMessage[];
  records: {
    firstPublicNumber: number | null;
    lastPublicNumber: number | null;
    winningPublicNumber: number | null;
    mostReactedPublicNumber: number | null;
    peakMessagesPerMinute: number;
    durationHours: number;
  };
};

export type SealedArchive = CanonicalArchive & {
  archiveHash: string;
};

function leafFor(message: CanonicalMessage): string {
  return [
    message.publicNumber,
    message.text,
    message.reactionCount,
    message.finalRank,
    message.publishedAt,
    message.isRemoved ? 1 : 0,
  ].join("\n");
}

export function merkleRoot(leaves: string[]): string {
  if (leaves.length === 0) return sha256Hex("");
  let level = leaves.map((leaf) => sha256Hex(leaf));
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1] ?? left;
      next.push(sha256Hex(`${left}${right}`));
    }
    level = next;
  }
  return level[0]!;
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort((a, b) => a.localeCompare(b))) {
    out[key] = sortKeysDeep(obj[key]);
  }
  return out;
}

/** Exact public bytes that the archive fingerprint hashes. */
export function serializeCanonicalArchive(body: CanonicalArchive): string {
  return `${JSON.stringify(sortKeysDeep(body), null, 2)}\n`;
}

export function archiveBodyOf(sealed: SealedArchive): CanonicalArchive {
  return Object.fromEntries(
    Object.entries(sealed).filter(([key]) => key !== "archiveHash"),
  ) as CanonicalArchive;
}

export function toCanonicalMessages(messages: PublicMessage[]): CanonicalMessage[] {
  return [...messages]
    .sort((a, b) => a.publicNumber - b.publicNumber)
    .map((message) => ({
      publicNumber: message.publicNumber,
      text: message.text,
      isRemoved: message.isRemoved,
      reactionCount: message.reactionCount,
      finalRank: message.finalRank ?? 0,
      publishedAt: message.publishedAt,
    }));
}

export function buildCanonicalArchive(input: {
  event: EventSnapshot;
  messages: PublicMessage[];
  records?: EditionRecords;
}): SealedArchive {
  const messages = toCanonicalMessages(input.messages);
  const records = input.records ?? recordsFromMessages(editionNumberOf(input.event), input.event, input.messages);
  const root = merkleRoot(messages.map(leafFor));
  const body: CanonicalArchive = {
    schema: ARCHIVE_SCHEMA,
    edition: editionNumberOf(input.event),
    title: input.event.title,
    startsAt: input.event.startsAt,
    endsAt: input.event.endsAt,
    finalizedAt: input.event.finalizedAt ?? input.event.archivedAt ?? input.event.endsAt,
    totalMessages: input.event.totalMessages,
    totalReactions: input.event.totalReactions,
    winningPublicNumber: records.winning?.publicNumber ?? null,
    merkleRoot: root,
    messages,
    records: {
      firstPublicNumber: records.first?.publicNumber ?? null,
      lastPublicNumber: records.last?.publicNumber ?? null,
      winningPublicNumber: records.winning?.publicNumber ?? null,
      mostReactedPublicNumber: records.mostReacted?.publicNumber ?? null,
      peakMessagesPerMinute: records.peakMessagesPerMinute,
      durationHours: records.durationHours,
    },
  };
  return {
    ...body,
    archiveHash: sha256Hex(serializeCanonicalArchive(body)),
  };
}
