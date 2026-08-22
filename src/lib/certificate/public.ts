import { ARCHIVAL_TAGLINE } from "@/lib/constants";
import type { CertificatePayload, EventSnapshot, PublicMessage } from "@/lib/types";
import { formatUtcDate } from "@/lib/utils";

export function publicCertificatePath(publicNumber: number): string {
  return `/message/${publicNumber}/certificate`;
}

export function publicCertificateImagePath(publicNumber: number, ratio: string): string {
  return `/message/${publicNumber}/certificate/image?ratio=${encodeURIComponent(ratio)}`;
}

export function certificateFromPublic(
  event: Pick<
    EventSnapshot,
    | "title"
    | "startsAt"
    | "editionNumber"
    | "totalMessages"
    | "archiveHash"
    | "merkleRoot"
    | "proofTx"
  >,
  message: Pick<
    PublicMessage,
    "publicNumber" | "text" | "reactionCount" | "finalRank" | "publishedAt"
  >,
): CertificatePayload {
  return {
    publicNumber: message.publicNumber,
    text: message.text,
    reactionCount: message.reactionCount,
    finalRank: message.finalRank,
    publishedAt: message.publishedAt,
    eventTitle: event.title,
    eventDate: formatUtcDate(event.startsAt),
    tagline: ARCHIVAL_TAGLINE,
    editionNumber: event.editionNumber ?? 1,
    totalMessages: event.totalMessages,
    archiveHash: event.archiveHash ?? null,
    merkleRoot: event.merkleRoot ?? null,
    proofTx: event.proofTx ?? null,
  };
}
