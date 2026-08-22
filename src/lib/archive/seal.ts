import "server-only";

import { buildCanonicalArchive, type SealedArchive } from "@/lib/archive/canonical";
import { publishArchiveCopies } from "@/lib/archive/copies";
import { buildArchiveManifest } from "@/lib/archive/manifest";
import { loadEditionLedger } from "@/lib/data/editions";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";
import { createServiceSupabase } from "@/lib/supabase/admin";
import type { EventSnapshot } from "@/lib/types";

export async function persistArchiveMetadata(
  event: Pick<EventSnapshot, "id" | "archiveUri" | "proofTx">,
  sealed: SealedArchive,
  extras?: { archiveUri?: string | null; proofTx?: string | null },
) {
  if (isSimulation() || !hasSupabaseConfig()) return;
  if (event.id === "local" || event.id.startsWith("local-")) return;
  const db = createServiceSupabase();
  const patch: Record<string, string> = {
    archive_hash: sealed.archiveHash,
    merkle_root: sealed.merkleRoot,
  };
  if (extras?.archiveUri && !event.archiveUri) patch.archive_uri = extras.archiveUri;
  if (extras?.proofTx && !event.proofTx) patch.proof_tx = extras.proofTx;
  const { error } = await db.from("events").update(patch).eq("id", event.id);
  if (error) {
    throw new Error("Could not persist archive fingerprints.");
  }
}

/** Freeze, hash, record, and copy the public dataset after stewardship finishes a Wall. */
export async function sealFinalizedEdition(event: EventSnapshot): Promise<SealedArchive> {
  const messages = await loadEditionLedger(event);
  const sealed = buildCanonicalArchive({ event, messages });
  const manifest = buildArchiveManifest({
    archive: sealed,
    replicaUri: event.archiveUri,
    proofRef: event.proofTx,
  });
  await persistArchiveMetadata(event, sealed);
  const published = await publishArchiveCopies({ archive: sealed, manifest });
  await persistArchiveMetadata(event, sealed, {
    archiveUri: published.archiveUri,
    proofTx: published.proofRef,
  });
  return sealed;
}
