import { afterEach, describe, expect, it } from "vitest";
import { applyAdminEventControl } from "@/lib/admin/event-control";
import {
  archiveBodyOf,
  buildCanonicalArchive,
  serializeCanonicalArchive,
} from "@/lib/archive/canonical";
import { fingerprintsMatch } from "@/lib/archive/verify";
import { certificateFromPublic } from "@/lib/certificate/public";
import { encodeCertificateQr } from "@/lib/certificate/qr";
import { lookupCertificate } from "@/lib/certificate/lookup";
import { MESSAGE_MAX_GRAPHEMES, PRICE_USDC } from "@/lib/constants";
import { createWallKey, hashWallKey, sha256Hex } from "@/lib/crypto";
import { AppError, ERROR_CODES } from "@/lib/errors";
import {
  createSimulatedIntent,
  currentSimulatedEvent,
  fulfillSimulatedPayment,
  getSimulatedEdition,
  getSimulatedMessage,
  listSimulatedEditions,
  listSimulatedMessages,
  lookupSimulatedCertificate,
  pickSimulatedRandomMessages,
  simulatedMessageList,
} from "@/lib/data/simulation";
import { getReactionCounts, listMessages, searchPublicMessages } from "@/lib/data/messages";
import { getNetwork } from "@/lib/env";
import { validateMessage } from "@/lib/message/normalize";
import { preflightMessage } from "@/lib/publish/preflight";
import { assignFinalRanks } from "@/lib/ranking";
import { sharePayloadForMessage } from "@/lib/share/copy";
import { parseShareableUrl } from "@/lib/share/links";
import {
  addReactions,
  closeForReview,
  createUnpaidIntent,
  discloseResults,
  openUpcomingWall,
  payAndPublish,
  reactOnce,
  resetAutomatedWall,
} from "@/lib/testing/harness";
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

function exactly140(seed: string) {
  const filler =
    "north river stone clock amber porch lantern quiet copper meadow harbor linen velvet orchard thunder silver cedar marble willow ember tide.";
  return validateMessage((`${seed} ${filler}`).slice(0, MESSAGE_MAX_GRAPHEMES));
}

describe("suite 33 — shortened staging wall end to end", () => {
  it("walks create → write → react → close → seal with evidence at each step", async () => {
    const evidence: Record<string, unknown> = {};
    const t0 = Date.now();

    const created = openUpcomingWall("E2E SHORT STAGING");
    evidence.step1_create = {
      phase: created.phase,
      title: created.title,
      durationMs: Date.parse(created.endsAt) - Date.parse(created.startsAt),
    };
    expect(created.phase).toBe("upcoming");
    expect(Date.parse(created.startsAt)).toBeGreaterThan(Date.now());

    const started = await applyAdminEventControl({
      action: "start",
      title: "E2E SHORT STAGING",
      durationMinutes: 5,
      startsAt: new Date(Date.now() - 1000).toISOString(),
    });
    const live = currentSimulatedEvent();
    evidence.step2_start = {
      phase: live.phase,
      previewPhase: started.phase,
      endsAt: live.endsAt,
      minutes: Math.round((Date.parse(live.endsAt) - Date.parse(live.startsAt)) / 60_000),
    };
    expect(live.phase).toBe("live");

    evidence.step3_landing = {
      title: live.title,
      taglinePossible: live.phase === "live",
      totalMessages: live.totalMessages,
    };

    const browse = await listMessages({
      eventId: live.id,
      sort: "new",
      limit: 12,
    });
    evidence.step4_5_enterBrowse = {
      eventId: live.id,
      shown: browse.messages.length,
      firstNumber: browse.messages[0]?.publicNumber ?? null,
      hasNext: Boolean(browse.nextCursor),
    };
    expect(browse.messages.length).toBeGreaterThan(0);

    const needle = browse.messages[0]?.text.slice(0, 12) ?? "the";
    const found = await searchPublicMessages(live.id, needle);
    const byNumber = await searchPublicMessages(live.id, String(browse.messages[0]?.publicNumber));
    evidence.step6_search = {
      needle,
      phraseHits: found.length,
      numberHits: byNumber.map((row) => row.publicNumber),
    };
    expect(found.length).toBeGreaterThan(0);
    expect(byNumber[0]?.publicNumber).toBe(browse.messages[0]?.publicNumber);

    const trendingBefore = await listMessages({ eventId: live.id, sort: "hot", limit: 8 });
    evidence.step7_trendingBefore = trendingBefore.messages.slice(0, 5).map((row) => ({
      n: row.publicNumber,
      fires: row.reactionCount,
    }));
    expect(trendingBefore.messages[0]?.reactionCount).toBeGreaterThanOrEqual(
      trendingBefore.messages.at(-1)?.reactionCount ?? 0,
    );

    const random = pickSimulatedRandomMessages({ eventId: live.id, count: 3, exclude: [] });
    evidence.step8_random = {
      count: random.messages.length,
      numbers: random.messages.map((row) => row.publicNumber),
      remaining: random.remaining,
    };
    expect(random.messages).toHaveLength(3);

    const sentence = exactly140("E2E-A");
    expect([...sentence].length).toBe(140);
    const preflight = await preflightMessage(sentence);
    evidence.step9_13_writeModerate = {
      graphemes: [...sentence].length,
      decision: preflight.decision,
      moderationStatus: preflight.moderationStatus,
    };
    expect(preflight.decision).toBe("allowed");

    const visitorA = "local-sim-e2e-a";
    const wallKey = createWallKey();
    const checkout = createSimulatedIntent({
      text: sentence,
      userId: visitorA,
      claimSecretHash: hashWallKey(wallKey),
    });
    evidence.step10_11_walletPay = {
      simulated: checkout.simulated,
      amount: checkout.amount,
      currency: checkout.currency,
      network: checkout.network,
      expectedNetwork: getNetwork(),
      recipient: checkout.recipient,
      intentId: checkout.intentId,
    };
    expect(checkout.amount).toBe(PRICE_USDC);
    expect(checkout.currency).toBe("USDC");
    expect(checkout.network).toBe(getNetwork());
    expect(checkout.simulated).toBe(true);

    const wrongPay = codeOf(() =>
      fulfillSimulatedPayment({
        intentId: checkout.intentId,
        userId: visitorA,
        paymentId: `0x${"ab".repeat(32)}`,
      }),
    );
    const published = fulfillSimulatedPayment({
      intentId: checkout.intentId,
      userId: visitorA,
      paymentId: checkout.simulatedPaymentId,
    });
    evidence.step12_verify = {
      rejectedWrongTx: wrongPay,
      publicNumber: published.publicNumber,
      messageId: published.messageId,
      recovered: published.recovered ?? false,
    };
    expect(wrongPay).toBe(ERROR_CODES.PAYMENT_FAILED);
    expect(published.publicNumber).toBeGreaterThan(18);

    const visible = getSimulatedMessage(published.publicNumber);
    const listed = simulatedMessageList();
    evidence.step14_15_numberVisible = {
      publicNumber: visible.publicNumber,
      unique: new Set(listed.map((row) => row.publicNumber)).size === listed.length,
      text: visible.text,
      fires: visible.reactionCount,
    };
    expect(visible.publicNumber).toBe(published.publicNumber);
    expect(visible.text).toBe(sentence);
    expect(listed.some((row) => row.publicNumber === published.publicNumber)).toBe(true);

    const visitorB = "local-sim-e2e-b";
    const seenByB = listSimulatedMessages({
      eventId: live.id,
      sort: "new",
      limit: 12,
    });
    const pulseBefore = await getReactionCounts(live.id, [published.messageId]);
    const firesAfterOne = reactOnce(published.messageId, visitorB);
    const pulseAfter = await getReactionCounts(live.id, [published.messageId]);
    evidence.step16_18_secondClientReactRealtime = {
      bSawMessage: seenByB.messages.some((row) => row.publicNumber === published.publicNumber),
      firesBefore: pulseBefore[published.messageId] ?? 0,
      firesAfterOne,
      pulseAfter: pulseAfter[published.messageId] ?? 0,
    };
    expect(seenByB.messages[0]?.publicNumber).toBe(published.publicNumber);
    expect(firesAfterOne).toBe(1);
    expect(pulseAfter[published.messageId]).toBe(1);

    addReactions(published.messageId, 80);
    const trendingAfter = await listMessages({ eventId: live.id, sort: "hot", limit: 8 });
    evidence.step19_trendingAfter = {
      top: trendingAfter.messages.slice(0, 3).map((row) => ({
        n: row.publicNumber,
        fires: row.reactionCount,
      })),
      winnerOnTop: trendingAfter.messages[0]?.publicNumber === published.publicNumber,
    };
    expect(trendingAfter.messages[0]?.publicNumber).toBe(published.publicNumber);

    const share = sharePayloadForMessage({
      event: currentSimulatedEvent(),
      message: getSimulatedMessage(published.publicNumber),
    });
    evidence.step20_share = {
      path: share.path,
      url: share.url,
      containsKey: share.url.includes(wallKey) || share.text.includes(wallKey),
      parsed: parseShareableUrl(share.url)?.pathname ?? null,
    };
    expect(share.path).toBe(`/message/${published.publicNumber}`);
    expect(parseShareableUrl(share.url)?.pathname).toBe(`/message/${published.publicNumber}`);
    expect(JSON.stringify(share)).not.toContain(wallKey);

    const approaching = currentSimulatedEvent();
    evidence.step21_approaching = {
      phase: approaching.phase,
      remainingMs: Date.parse(approaching.endsAt) - Date.now(),
    };
    expect(approaching.phase).toBe("live");
    const unpaid = createUnpaidIntent("Late unpaid must not publish.");

    const closed = closeForReview();
    evidence.step22_close = { phase: closed.phase, endsAt: closed.endsAt };
    expect(closed.phase).toBe("finalizing");

    const lateWrite = codeOf(() =>
      createSimulatedIntent({
        text: exactly140("E2E-late"),
        userId: "local-sim-e2e-late",
        claimSecretHash: hashWallKey(createWallKey()),
      }),
    );
    const latePay = codeOf(() =>
      fulfillSimulatedPayment({
        intentId: unpaid.checkout.intentId,
        userId: unpaid.userId,
        paymentId: unpaid.checkout.simulatedPaymentId,
      }),
    );
    const lateReact = codeOf(() => reactOnce(published.messageId, "local-sim-e2e-late-fire"));
    evidence.step23_26_rejected = { lateWrite, latePay, lateReact };
    expect([ERROR_CODES.EVENT_ENDED, ERROR_CODES.EVENT_NOT_LIVE, ERROR_CODES.PAID_AFTER_CLOSE]).toContain(
      lateWrite,
    );
    expect([ERROR_CODES.EVENT_ENDED, ERROR_CODES.EVENT_NOT_LIVE, ERROR_CODES.PAID_AFTER_CLOSE]).toContain(
      latePay,
    );
    expect([ERROR_CODES.EVENT_ENDED, ERROR_CODES.EVENT_NOT_LIVE]).toContain(lateReact);

    const sealed = await discloseResults();
    const edition = listSimulatedEditions()[0]!;
    const snapshot = getSimulatedEdition(edition.editionNumber)!;
    const ranks = assignFinalRanks(snapshot.messages);
    const winner = snapshot.messages.find((row) => row.publicNumber === published.publicNumber);
    evidence.step27_ranks = {
      phase: sealed.phase,
      living: ranks.filter((row) => row.finalRank != null).length,
      winnerRank: winner?.finalRank ?? null,
      winnerFires: winner?.reactionCount ?? null,
      uniqueRanks: new Set(ranks.filter((row) => row.finalRank != null).map((row) => row.finalRank)).size,
    };
    expect(sealed.phase).toBe("archived");
    expect(winner?.finalRank).toBe(1);

    const cert = lookupSimulatedCertificate(wallKey);
    const viaLookup = await lookupCertificate(wallKey);
    const publicCert = certificateFromPublic(sealed, getSimulatedMessage(published.publicNumber));
    const qr = encodeCertificateQr(published.publicNumber, "http://localhost:3000");
    evidence.step28_29_certificate = {
      publicNumber: cert?.publicNumber,
      rank: cert?.finalRank,
      fires: cert?.reactionCount,
      hasKey: isOwnershipSecret(wallKey),
      lookupMatches: viaLookup.publicNumber === published.publicNumber,
      publicOmitsKey: !JSON.stringify(publicCert).includes(wallKey),
      qrUrl: qr.url,
    };
    expect(cert?.publicNumber).toBe(published.publicNumber);
    expect(cert?.finalRank).toBe(1);
    expect(viaLookup.text).toBe(sentence);
    expect(qr.url).toBe(`http://localhost:3000/message/${published.publicNumber}/certificate`);

    const rebuilt = buildCanonicalArchive({
      event: snapshot.event,
      messages: snapshot.messages,
    });
    const body = archiveBodyOf(rebuilt);
    evidence.step30_31_archive = {
      dbCount: snapshot.messages.length,
      archiveCount: rebuilt.messages.length,
      hashMatch: fingerprintsMatch(rebuilt.archiveHash, edition.archiveHash ?? ""),
      storedHash: edition.archiveHash,
      rebuiltHash: rebuilt.archiveHash,
      unpaidAbsent: snapshot.messages.every((row) => row.text !== unpaid.text),
      canonicalBytes: serializeCanonicalArchive(body).length,
    };
    expect(rebuilt.messages).toHaveLength(snapshot.messages.length);
    expect(rebuilt.archiveHash).toBe(edition.archiveHash);
    expect(rebuilt.totalMessages).toBe(snapshot.event.totalMessages);

    const reopened = getSimulatedMessage(published.publicNumber);
    const afterSealWrite = codeOf(() =>
      createSimulatedIntent({
        text: exactly140("E2E-after-seal"),
        userId: "local-sim-e2e-after",
        claimSecretHash: hashWallKey(createWallKey()),
      }),
    );
    const afterSealReact = codeOf(() => reactOnce(published.messageId, "local-sim-e2e-after-fire"));
    evidence.step32_33_readonly = {
      text: reopened.text,
      number: reopened.publicNumber,
      shareable: parseShareableUrl(`http://localhost:3000/message/${published.publicNumber}`)?.pathname,
      write: afterSealWrite,
      react: afterSealReact,
    };
    expect(reopened.text).toBe(sentence);
    expect(afterSealWrite).not.toBeUndefined();
    expect([ERROR_CODES.EVENT_ENDED, ERROR_CODES.EVENT_NOT_LIVE]).toContain(afterSealWrite);
    expect([ERROR_CODES.EVENT_ENDED, ERROR_CODES.EVENT_NOT_LIVE]).toContain(afterSealReact);

    evidence.elapsedMs = Date.now() - t0;
    evidence.secondFinish = await discloseResults()
      .then(() => "accepted")
      .catch((error) => (error instanceof AppError ? error.code : "error"));
    expect(evidence.secondFinish).not.toBe("accepted");
    expect(evidence.step22_close).toBeTruthy();
  });
});


