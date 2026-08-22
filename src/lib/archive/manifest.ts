import type { SealedArchive } from "@/lib/archive/canonical";
import { editionManifestPath, editionPath, siteUrl } from "@/lib/utils";

export const MANIFEST_SCHEMA = "thewall.archive.manifest.v1";

export type ArchiveCopyKind = "site" | "manifest" | "replica" | "proof";

export type ArchiveCopy = {
  kind: ArchiveCopyKind;
  uri: string;
};

export type ArchiveManifest = {
  schema: typeof MANIFEST_SCHEMA;
  edition: number;
  title: string;
  startsAt: string;
  endsAt: string;
  finalizedAt: string;
  totalMessages: number;
  totalReactions: number;
  winningPublicNumber: number | null;
  archiveHash: string;
  merkleRoot: string;
  copies: ArchiveCopy[];
  proofRef: string | null;
};

export function siteArchiveCopies(edition: number, origin = siteUrl()): ArchiveCopy[] {
  const base = origin.replace(/\/$/, "");
  return [
    { kind: "site", uri: `${base}${editionPath(edition)}/download` },
    { kind: "manifest", uri: `${base}${editionManifestPath(edition)}` },
  ];
}

export function buildArchiveManifest(input: {
  archive: SealedArchive;
  copies?: ArchiveCopy[];
  proofRef?: string | null;
  replicaUri?: string | null;
}): ArchiveManifest {
  const copies = [...(input.copies ?? siteArchiveCopies(input.archive.edition))];
  const replica = input.replicaUri?.trim();
  if (replica && !copies.some((copy) => copy.uri === replica)) {
    copies.push({ kind: "replica", uri: replica });
  }
  const proof = input.proofRef?.trim();
  if (proof && !copies.some((copy) => copy.uri === proof)) {
    copies.push({ kind: "proof", uri: proof });
  }
  return {
    schema: MANIFEST_SCHEMA,
    edition: input.archive.edition,
    title: input.archive.title,
    startsAt: input.archive.startsAt,
    endsAt: input.archive.endsAt,
    finalizedAt: input.archive.finalizedAt,
    totalMessages: input.archive.totalMessages,
    totalReactions: input.archive.totalReactions,
    winningPublicNumber: input.archive.winningPublicNumber,
    archiveHash: input.archive.archiveHash,
    merkleRoot: input.archive.merkleRoot,
    copies,
    proofRef: proof || null,
  };
}

export function serializeArchiveManifest(manifest: ArchiveManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
