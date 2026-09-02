import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { applyAdminEventControl } from "@/lib/admin/event-control";
import {
  LOCAL_ADMIN_EMAIL_DEFAULT,
  localAdminCookieValid,
  localAdminCredentialsMatch,
  signLocalAdminCookie,
} from "@/lib/admin/local";
import { REVIEW_HOLD_TEXT } from "@/lib/constants";
import { buildCanonicalArchive } from "@/lib/archive/canonical";
import { certificateFromPublic } from "@/lib/certificate/public";
import { createWallKey, hashWallKey, sha256Hex } from "@/lib/crypto";
import {
  addSimulatedReaction,
  configureSimulatedWall,
  createSimulatedIntent,
  currentSimulatedEvent,
  fulfillSimulatedPayment,
  getSimulatedEdition,
  getSimulatedMessage,
  listSimulatedEditions,
  lookupSimulatedCertificate,
  simulatedMessageList,
} from "@/lib/data/simulation";
import { listMessages } from "@/lib/data/messages";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { evaluateModeration } from "@/lib/moderation/rules";
import { preflightMessage } from "@/lib/publish/preflight";
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

describe("suite 34 — adversarial combinations", () => {
  it("does not publish from an unpaid, stolen, or replayed checkout", () => {
    openShortLiveWall();
    const honest = payAndPublish("Honest paid sentence.");
    const unpaid = createUnpaidIntent("Unpaid must not appear.");
    expect(
      codeOf(() =>
        fulfillSimulatedPayment({
          intentId: unpaid.checkout.intentId,
          userId: unpaid.userId,
          paymentId: `0x${"00".repeat(32)}`,
        }),
      ),
    ).toBe(ERROR_CODES.PAYMENT_FAILED);
    expect(
      codeOf(() =>
        fulfillSimulatedPayment({
          intentId: unpaid.checkout.intentId,
          userId: unpaid.userId,
          paymentId: honest.paymentId,
        }),
      ),
    ).toBe(ERROR_CODES.PAYMENT_FAILED);
    expect(
      codeOf(() =>
        fulfillSimulatedPayment({
          intentId: unpaid.checkout.intentId,
          userId: "local-sim-thief",
          paymentId: unpaid.checkout.simulatedPaymentId,
        }),
      ),
    ).toBe(ERROR_CODES.FORBIDDEN);
    const replay = fulfillSimulatedPayment({
      intentId: honest.intentId,
      userId: honest.userId,
      paymentId: honest.paymentId,
    });
    expect(replay.publicNumber).toBe(honest.publicNumber);
    expect(replay.recovered).toBe(true);
    expect(simulatedMessageList().filter((row) => row.text === unpaid.text)).toHaveLength(0);
    expect(simulatedMessageList().filter((row) => row.text === honest.text)).toHaveLength(1);
  });

  it("keeps unique numbers when many checkouts confirm in one turn", async () => {
    openShortLiveWall();
    const marks = await Promise.all(
      Array.from({ length: 16 }, (_, i) =>
        Promise.resolve(payAndPublish(`Race sentence ${i} ${Date.now().toString(36)}.`)),
      ),
    );
    const numbers = marks.map((row) => row.publicNumber);
    expect(new Set(numbers).size).toBe(16);
  });

  it("cannot write or react after close even if the clock is pushed forward", () => {
    openShortLiveWall();
    const mark = payAndPublish("Still here after the rollback attempt.");
    closeForReview();
    expect(currentSimulatedEvent().phase).toBe("finalizing");
    const rolled = configureSimulatedWall({
      endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    expect(rolled.phase).not.toBe("live");
    expect(
      codeOf(() =>
        createSimulatedIntent({
          text: "Reopened by clock edit.",
          userId: "local-sim-clock",
          claimSecretHash: hashWallKey(createWallKey()),
        }),
      ),
    ).toBe(ERROR_CODES.EVENT_ENDED);
    expect(codeOf(() => reactOnce(mark.messageId, "local-sim-clock-fire"))).toBe(
      ERROR_CODES.EVENT_ENDED,
    );
  });

  it("pays a flagged-but-payable sentence once; late pay after close does not carve", async () => {
    openShortLiveWall();
    const flagged = evaluateModeration("maybe this needs review but is not blocked");
    expect(["allowed", "review_required"]).toContain(flagged.decision);
    const urlSpam = await preflightMessage("visit https://evil.example/drop");
    expect(urlSpam.decision).toBe("review_required");
    expect(urlSpam.moderationStatus).toBe("flagged");
    const liveLink = payAndPublish("Read this at https://phish.example/login");
    expect(getSimulatedMessage(liveLink.publicNumber).text).toBe(REVIEW_HOLD_TEXT);
    expect(getSimulatedMessage(liveLink.publicNumber).isHeld).toBe(true);
    const listed = await listMessages({
      eventId: currentSimulatedEvent().id,
      sort: "new",
      limit: 50,
    });
    expect(listed.messages.some((row) => row.publicNumber === liveLink.publicNumber)).toBe(false);
    const unpaid = createUnpaidIntent("Late pay after the bell.");
    closeForReview();
    expect(
      codeOf(() =>
        fulfillSimulatedPayment({
          intentId: unpaid.checkout.intentId,
          userId: unpaid.userId,
          paymentId: unpaid.checkout.simulatedPaymentId,
        }),
      ),
    ).toBe(ERROR_CODES.PAID_AFTER_CLOSE);
    expect(simulatedMessageList().some((row) => row.text === unpaid.text)).toBe(false);
  });

  it("lets unique identities farm 🔥 and take Most 🔥 — one identity cannot", async () => {
    openShortLiveWall();
    const quiet = payAndPublish("Quiet sentence for the farm.");
    const target = payAndPublish("Farm this sentence to the top.");
    addSimulatedReaction(target.messageId, "same-bot");
    expect(codeOf(() => addSimulatedReaction(target.messageId, "same-bot"))).toBe(
      ERROR_CODES.DUPLICATE_REACTION,
    );
    addReactions(target.messageId, 40);
    const afterForty = await listMessages({
      eventId: currentSimulatedEvent().id,
      sort: "hot",
      limit: 5,
    });
    expect(afterForty.messages[0]?.publicNumber).toBe(4);
    expect(getSimulatedMessage(target.publicNumber).reactionCount).toBe(41);
    for (let i = 0; i < 40; i += 1) {
      reactOnce(target.messageId, `local-sim-farm-extra-${i}`);
    }
    const hot = await listMessages({
      eventId: currentSimulatedEvent().id,
      sort: "hot",
      limit: 5,
    });
    expect(hot.messages[0]?.publicNumber).toBe(target.publicNumber);
    expect(hot.messages[0]?.publicNumber).not.toBe(quiet.publicNumber);
    expect(getSimulatedMessage(target.publicNumber).reactionCount).toBe(81);
  });

  it("keeps the archive hash honest after an official redaction", async () => {
    openShortLiveWall();
    const winner = payAndPublish("Winner for the red-team seal.");
    addReactions(winner.messageId, 80);
    await discloseResults();
    const edition = listSimulatedEditions()[0]!;
    const before = edition.archiveHash;
    const row = getSimulatedEdition(edition.editionNumber)?.messages.find(
      (message) => message.publicNumber === winner.publicNumber,
    );
    expect(row?.id).toBeTruthy();
    const { moderateSimulatedMessage } = await import("@/lib/data/simulation");
    moderateSimulatedMessage({ messageId: row!.id, action: "remove" });
    const after = getSimulatedEdition(edition.editionNumber)!;
    const rebuilt = buildCanonicalArchive({ event: after.event, messages: after.messages });
    expect(after.event.archiveHash).toBe(rebuilt.archiveHash);
    expect(after.event.archiveHash).not.toBe(before);
    const cert = certificateFromPublic(after.event, after.messages.find((m) => m.publicNumber === winner.publicNumber)!);
    expect(cert.text).not.toBe(winner.text);
    expect(JSON.stringify(cert)).not.toContain(winner.wallKey);
    expect(lookupSimulatedCertificate(winner.wallKey)?.finalRank).toBe(1);
  });

  it("does not mint a second official rank or open a Wall Key URL as shareable", async () => {
    openShortLiveWall();
    const winner = payAndPublish("Only one finish.");
    addReactions(winner.messageId, 80);
    await discloseResults();
    await expect(
      applyAdminEventControl({ action: "finish", confirm: true, confirmText: "FINISH" }),
    ).rejects.toBeInstanceOf(AppError);
    expect(listSimulatedEditions()).toHaveLength(1);
    expect(parseShareableUrl(`http://localhost:3000/certificate/${winner.wallKey}`)).toBeNull();
  });

  it("rejects a forged email-hash admin cookie", () => {
    const forged = sha256Hex(LOCAL_ADMIN_EMAIL_DEFAULT);
    expect(forged).toBe(
      createHash("sha256").update(LOCAL_ADMIN_EMAIL_DEFAULT, "utf8").digest("hex"),
    );
    expect(localAdminCookieValid(forged)).toBe(false);
    expect(localAdminCookieValid(signLocalAdminCookie())).toBe(true);
    expect(localAdminCredentialsMatch(LOCAL_ADMIN_EMAIL_DEFAULT, "wrong-password")).toBe(false);
  });
});
