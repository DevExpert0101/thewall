import { afterEach, describe, expect, it } from "vitest";
import {
  archiveBodyOf,
  buildCanonicalArchive,
  serializeCanonicalArchive,
} from "@/lib/archive/canonical";
import { fingerprintsMatch } from "@/lib/archive/verify";
import { encodeCertificateQr } from "@/lib/certificate/qr";
import {
  certificateFromPublic,
  publicCertificatePath,
} from "@/lib/certificate/public";
import { lookupCertificate } from "@/lib/certificate/lookup";
import { createWallKey, sha256Hex } from "@/lib/crypto";
import { AppError, ERROR_CODES } from "@/lib/errors";
import {
  currentSimulatedEvent,
  getSimulatedEdition,
  getSimulatedMessage,
  listSimulatedEditions,
  lookupSimulatedCertificate,
  moderateSimulatedMessage,
  simulatedMessageList,
} from "@/lib/data/simulation";
import { assignFinalRanks } from "@/lib/ranking";
import { parseShareableUrl } from "@/lib/share/links";
import {
  addReactions,
  closeForReview,
  createUnpaidIntent,
  discloseResults,
  openShortLiveWall,
  payAndPublish,
  reactOnce,
  resetAutomatedWall,
} from "@/lib/testing/harness";
import { formatObjectIdentity, formatUtcDate } from "@/lib/utils";
import { certificateQuerySchema } from "@/lib/validation";
import { isOwnershipSecret } from "@/lib/ownership/wall-key";

afterEach(() => {
  resetAutomatedWall();
});

function codeOf(fn: () => unknown) {
  try {
    fn();
  } catch (error) {
    return (error as AppError).code;
  }
  throw new Error("expected failure");
}

async function runShortWall() {
  openShortLiveWall();
  const unpaid = createUnpaidIntent("Unpaid sentence must not enter the archive.");
  const quiet = payAndPublish("Archive quiet sentence.");
  const winner = payAndPublish("Archive winner sentence.");
  const late = payAndPublish("Archive late sentence.");
  addReactions(winner.messageId, 80);
  addReactions(quiet.messageId, 6);
  addReactions(late.messageId, 2);
  const extras = [quiet, winner, late];
  const beforeClose = {
    messages: simulatedMessageList(),
    totals: {
      messages: currentSimulatedEvent().totalMessages,
      reactions: currentSimulatedEvent().totalReactions,
    },
    ranks: assignFinalRanks(simulatedMessageList()),
  };
  const closed = closeForReview();
  const sealed = await discloseResults();
  return { unpaid, extras, winner, quiet, late, beforeClose, closed, sealed };
}

describe("suite 32 — archive and certificate system", () => {
  it("stops writes and 🔥 at close, then freezes ranks, counts, and the archive", async () => {
    const run = await runShortWall();
    expect(run.closed.phase).toBe("finalizing");
    expect(run.sealed.phase).toBe("archived");

    expect([ERROR_CODES.EVENT_ENDED, ERROR_CODES.EVENT_NOT_LIVE]).toContain(
      codeOf(() => payAndPublish("After close this must not carve.")),
    );
    expect([ERROR_CODES.EVENT_ENDED, ERROR_CODES.EVENT_NOT_LIVE]).toContain(
      codeOf(() => reactOnce(run.winner.messageId, "local-sim-after-close")),
    );

    const edition = listSimulatedEditions()[0];
    expect(edition).toBeTruthy();
    const snapshot = getSimulatedEdition(edition!.editionNumber);
    expect(snapshot).toBeTruthy();
    if (!snapshot) return;

    const living = snapshot.messages.filter((row) => !row.isRemoved);
    const ranks = living.map((row) => row.finalRank);
    expect(ranks.every((rank) => typeof rank === "number")).toBe(true);
    expect(new Set(ranks).size).toBe(ranks.length);
    expect(living.filter((row) => row.finalRank === 1)).toHaveLength(1);
    expect(snapshot.messages.find((row) => row.publicNumber === run.winner.publicNumber)?.finalRank).toBe(
      1,
    );

    const winnerRow = snapshot.messages.find((row) => row.publicNumber === run.winner.publicNumber);
    expect(winnerRow?.reactionCount).toBe(80);
    expect(winnerRow?.text).toBe(run.winner.text);

    const sealed = buildCanonicalArchive({
      event: snapshot.event,
      messages: snapshot.messages,
    });
    expect(sealed.archiveHash).toBe(edition!.archiveHash);
    expect(sealed.totalMessages).toBe(snapshot.event.totalMessages);
    expect(sealed.messages).toHaveLength(snapshot.messages.length);
    expect(sealed.winningPublicNumber).toBe(run.winner.publicNumber);

    const dbCount = snapshot.messages.length;
    const archiveCount = sealed.messages.length;
    const publishedExtras = run.extras.length;
    const certificates = run.extras.filter((row) => isOwnershipSecret(row.wallKey)).length;
    const ranked = living.length;
    expect(dbCount).toBe(archiveCount);
    expect(dbCount).toBe(run.beforeClose.messages.length);
    expect(publishedExtras).toBe(3);
    expect(certificates).toBe(3);
    expect(ranked).toBe(dbCount - snapshot.messages.filter((row) => row.isRemoved).length);
    expect(unpaidMissing(run.unpaid.text, snapshot.messages)).toBe(true);

    expect(getSimulatedMessage(run.winner.publicNumber).text).toBe(run.winner.text);
    expect(parseShareableUrl(`http://localhost:3000/message/${run.winner.publicNumber}`)?.pathname).toBe(
      `/message/${run.winner.publicNumber}`,
    );
    expect(publicCertificatePath(run.winner.publicNumber)).toBe(
      `/message/${run.winner.publicNumber}/certificate`,
    );
  });

  it("issues unique Wall Keys and rejects a modified certificate id", async () => {
    const run = await runShortWall();
    const keys = run.extras.map((row) => row.wallKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(keys.map((key) => sha256Hex(key))).size).toBe(keys.length);

    const winnerCert = lookupSimulatedCertificate(run.winner.wallKey);
    expect(winnerCert).toBeTruthy();
    expect(winnerCert?.publicNumber).toBe(run.winner.publicNumber);
    expect(winnerCert?.text).toBe(run.winner.text);
    expect(winnerCert?.reactionCount).toBe(80);
    expect(winnerCert?.finalRank).toBe(1);
    expect(winnerCert?.eventDate).toBe(formatUtcDate(run.sealed.startsAt));
    expect(winnerCert?.archiveHash).toBe(listSimulatedEditions()[0]?.archiveHash);

    const viaLookup = await lookupCertificate(run.winner.wallKey);
    expect(viaLookup.publicNumber).toBe(run.winner.publicNumber);
    expect(viaLookup.finalRank).toBe(1);

    expect(lookupSimulatedCertificate(run.quiet.wallKey)?.publicNumber).toBe(run.quiet.publicNumber);
    expect(lookupSimulatedCertificate(run.quiet.wallKey)?.finalRank).not.toBe(1);

    const flipped = `${run.winner.wallKey.slice(0, -1)}A`;
    expect(lookupSimulatedCertificate(flipped)).toBeNull();
    await expect(lookupCertificate(flipped)).rejects.toMatchObject({
      code: ERROR_CODES.CERTIFICATE_INVALID,
    });
    expect(lookupSimulatedCertificate(run.quiet.wallKey)?.text).not.toBe(run.winner.text);
    expect(certificateQuerySchema.safeParse({ token: "abc" }).success).toBe(false);
    expect(certificateQuerySchema.safeParse({ token: run.winner.wallKey }).success).toBe(true);

    const publicView = certificateFromPublic(run.sealed, getSimulatedMessage(run.winner.publicNumber));
    expect(publicView.publicNumber).toBe(run.winner.publicNumber);
    expect(publicView.text).toBe(run.winner.text);
    expect(publicView.reactionCount).toBe(80);
    expect(publicView.finalRank).toBe(1);
    expect(formatObjectIdentity(publicView.publicNumber, publicView.editionNumber)).toContain(
      String(run.winner.publicNumber).padStart(6, "0"),
    );
    expect(JSON.stringify(publicView)).not.toContain(run.winner.wallKey);
  });

  it("cannot display a swapped number, text, count, rank, date, or key", async () => {
    const run = await runShortWall();
    const cert = lookupSimulatedCertificate(run.winner.wallKey)!;
    const other = lookupSimulatedCertificate(run.quiet.wallKey)!;
    expect(cert.publicNumber).not.toBe(other.publicNumber);
    expect(cert.text).not.toBe(other.text);
    expect(cert.reactionCount).not.toBe(other.reactionCount);
    expect(cert.finalRank).not.toBe(other.finalRank);

    const forged = {
      ...cert,
      publicNumber: other.publicNumber,
      text: "Forged sentence.",
      reactionCount: 999,
      finalRank: 1,
      eventDate: "1 January 1999",
    };
    const ledger = getSimulatedMessage(run.winner.publicNumber);
    expect(forged.publicNumber).not.toBe(ledger.publicNumber);
    expect(forged.text).not.toBe(ledger.text);
    expect(forged.reactionCount).not.toBe(ledger.reactionCount);
    const honest = certificateFromPublic(run.sealed, ledger);
    expect(honest.publicNumber).toBe(ledger.publicNumber);
    expect(honest.text).toBe(ledger.text);
    expect(honest.reactionCount).toBe(ledger.reactionCount);
    expect(honest.finalRank).toBe(ledger.finalRank);
    expect(honest.eventDate).toBe(formatUtcDate(run.sealed.startsAt));
  });

  it("detects an altered archive after closure and does not mint a second seal", async () => {
    const run = await runShortWall();
    const edition = listSimulatedEditions()[0]!;
    const snapshot = getSimulatedEdition(edition.editionNumber)!;
    const sealed = buildCanonicalArchive({
      event: snapshot.event,
      messages: snapshot.messages,
    });
    expect(fingerprintsMatch(sealed.archiveHash, edition.archiveHash ?? "")).toBe(true);

    const body = archiveBodyOf(sealed);
    const tampered = structuredClone(body);
    tampered.messages[0] = { ...tampered.messages[0]!, text: "changed after seal" };
    expect(sha256Hex(serializeCanonicalArchive(tampered))).not.toBe(sealed.archiveHash);
    tampered.messages[0] = { ...body.messages[0]!, reactionCount: 999 };
    expect(sha256Hex(serializeCanonicalArchive(tampered))).not.toBe(sealed.archiveHash);
    const rankSwap = structuredClone(body);
    rankSwap.messages[0] = { ...rankSwap.messages[0]!, finalRank: 99 };
    expect(sha256Hex(serializeCanonicalArchive(rankSwap))).not.toBe(sealed.archiveHash);

    await expect(discloseResults()).rejects.toBeInstanceOf(AppError);
    expect(listSimulatedEditions()).toHaveLength(1);
    expect(listSimulatedEditions()[0]?.archiveHash).toBe(edition.archiveHash);

    const archivedWinner = snapshot.messages.find(
      (row) => row.publicNumber === run.winner.publicNumber,
    );
    expect(archivedWinner?.id).toBeTruthy();
    moderateSimulatedMessage({ messageId: archivedWinner!.id, action: "remove" });
    const afterRedact = getSimulatedEdition(edition.editionNumber)!;
    const rebuilt = buildCanonicalArchive({
      event: afterRedact.event,
      messages: afterRedact.messages,
    });
    expect(afterRedact.messages.find((row) => row.publicNumber === run.winner.publicNumber)?.text).not.toBe(
      run.winner.text,
    );
    expect(afterRedact.event.archiveHash).toBe(rebuilt.archiveHash);
    expect(listSimulatedEditions()[0]?.archiveHash).toBe(rebuilt.archiveHash);
    expect(rebuilt.archiveHash).not.toBe(edition.archiveHash);
  });

  it("encodes a QR for the public certificate URL and never a Wall Key", () => {
    const qr = encodeCertificateQr(19, "http://localhost:3000");
    expect(qr.url).toBe("http://localhost:3000/message/19/certificate");
    expect(qr.data.length).toBeGreaterThan(20);
    expect(publicCertificatePath(19)).toBe("/message/19/certificate");
    expect(parseShareableUrl(qr.url)?.pathname).toBe("/message/19/certificate");
    expect(parseShareableUrl("http://localhost:3000/certificate/WKSECRETTOKEN12")).toBeNull();
  });
});

function unpaidMissing(text: string, messages: { text: string }[]) {
  return messages.every((row) => row.text !== text);
}
