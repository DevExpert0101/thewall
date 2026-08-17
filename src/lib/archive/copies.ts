import type { ArchiveCopy, ArchiveManifest } from "@/lib/archive/manifest";
import type { SealedArchive } from "@/lib/archive/canonical";
import { archiveBodyOf, serializeCanonicalArchive } from "@/lib/archive/canonical";

function optionalUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

function publicUri(value: unknown): string | null {
  return typeof value === "string" ? optionalUrl(value) : null;
}

export function archiveReplicaWebhookUrl(): string | null {
  return optionalUrl(process.env.ARCHIVE_REPLICA_WEBHOOK_URL);
}

export function archiveProofWebhookUrl(): string | null {
  return optionalUrl(process.env.ARCHIVE_PROOF_WEBHOOK_URL);
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

export type PublishedCopies = {
  copies: ArchiveCopy[];
  archiveUri: string | null;
  proofRef: string | null;
};

/**
 * Extra copies beyond the site download. Failures are ignored so a seal still
 * completes. Payloads are the public dataset and manifest only.
 */
export async function publishArchiveCopies(input: {
  archive: SealedArchive;
  manifest: ArchiveManifest;
}): Promise<PublishedCopies> {
  const published: ArchiveCopy[] = [...input.manifest.copies];
  const dataset = serializeCanonicalArchive(archiveBodyOf(input.archive));
  let archiveUri: string | null = input.manifest.copies.find((copy) => copy.kind === "replica")?.uri ?? null;
  let proofRef: string | null = input.manifest.proofRef;

  const replica = archiveReplicaWebhookUrl();
  if (replica) {
    try {
      const body = await postJson(replica, {
        schema: "thewall.archive.replica.v1",
        manifest: input.manifest,
        archive: JSON.parse(dataset) as unknown,
      });
      const uri = publicUri((body as { uri?: unknown } | null)?.uri);
      if (uri) {
        archiveUri = uri;
        if (!published.some((copy) => copy.uri === uri)) {
          published.push({ kind: "replica", uri });
        }
      }
    } catch {
      // replica is optional permanence, not a condition of sealing
    }
  }

  const proof = archiveProofWebhookUrl();
  if (proof) {
    try {
      const body = await postJson(proof, {
        schema: "thewall.archive.proof.v1",
        edition: input.archive.edition,
        title: input.archive.title,
        finalizedAt: input.archive.finalizedAt,
        archiveHash: input.archive.archiveHash,
        merkleRoot: input.archive.merkleRoot,
        totalMessages: input.archive.totalMessages,
      });
      const ref =
        publicUri((body as { ref?: unknown } | null)?.ref) ??
        publicUri((body as { tx?: unknown } | null)?.tx) ??
        (typeof (body as { tx?: unknown } | null)?.tx === "string"
          ? String((body as { tx: string }).tx)
          : null);
      if (ref) {
        proofRef = ref;
        if (!published.some((copy) => copy.uri === ref)) {
          published.push({ kind: "proof", uri: ref });
        }
      }
    } catch {
      // independent notice is optional
    }
  }

  return { copies: published, archiveUri, proofRef };
}
