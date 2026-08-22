import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ARCHIVAL_REMOVAL_TEXT } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { validateMessage } from "@/lib/message/normalize";
import { assignFinalRanks } from "@/lib/ranking";
import { recordsFromMessages } from "@/lib/archive/records";
import { loadVictorRace } from "@/lib/data/load";
import {
  currentSimulatedEvent,
  listSimulatedEditions,
  listSimulatedMessages,
  lookupSimulatedCertificate,
  moderateSimulatedMessage,
  simulatedMessageList,
  simulatedTextAlreadyPublished,
} from "@/lib/data/simulation";
import { VictorRace } from "@/components/victor-race";
import {
  addReactions,
  claimWithKey,
  closeForReview,
  discloseResults,
  monumentCatalog,
  openShortLiveWall,
  payAndPublish,
  resetAutomatedWall,
} from "@/lib/testing/harness";
import { preflightMessage } from "@/lib/publish/preflight";

afterEach(() => {
  resetAutomatedWall();
});

function leadPair() {
  openShortLiveWall();
  const living = payAndPublish("Still standing after review.");
  const illegal = payAndPublish("Illegal leader for review.");
  addReactions(living.messageId, 80);
  addReactions(illegal.messageId, 90);
  return { living, illegal };
}

describe("suite 21 — exploratory QA", () => {
  it("skips a removed live leader in the provisional Monument race", async () => {
    const { living, illegal } = leadPair();
    moderateSimulatedMessage({ messageId: illegal.messageId, action: "remove" });

    const hot = listSimulatedMessages({ sort: "hot", limit: 8 }).messages;
    const race = await loadVictorRace(currentSimulatedEvent());
    const firstLivingHot = hot.find((row) => !row.isRemoved);

    expect(firstLivingHot?.publicNumber).toBe(living.publicNumber);
    expect(race[0]?.publicNumber).toBe(living.publicNumber);
    expect(race[0]?.isRemoved).toBe(false);
    expect(race.some((row) => row.publicNumber === illegal.publicNumber)).toBe(false);

    render(<VictorRace leaders={race} live />);
    expect(screen.getByText(/still standing after review/i)).toBeInTheDocument();
    expect(screen.queryByText(ARCHIVAL_REMOVAL_TEXT)).not.toBeInTheDocument();
  });

  it("lets the same sentence be paid again after the original is removed", async () => {
    openShortLiveWall();
    const first = payAndPublish("Once carved, then taken down.");
    moderateSimulatedMessage({ messageId: first.messageId, action: "remove" });
    expect(simulatedTextAlreadyPublished(first.text)).toBe(false);
    await expect(preflightMessage(first.text)).resolves.toMatchObject({ text: first.text });
  });

  it("restores a removed leader before Finish and gives that sentence #1", async () => {
    const { living, illegal } = leadPair();
    closeForReview();
    moderateSimulatedMessage({ messageId: illegal.messageId, action: "remove" });
    moderateSimulatedMessage({ messageId: illegal.messageId, action: "restore" });
    await discloseResults();
    expect(listSimulatedEditions()[0]?.winning?.publicNumber).toBe(illegal.publicNumber);
    expect(listSimulatedEditions()[0]?.winning?.text).toBe(illegal.text);
    expect(monumentCatalog()[0]?.text).toBe(illegal.text);
    expect(monumentCatalog()[0]?.originalPublicNumber).not.toBe(living.publicNumber);
  });

  it("breaks a living tie by earlier publish after the leader is removed", async () => {
    openShortLiveWall();
    const earlier = payAndPublish("Earlier living tie.");
    const later = payAndPublish("Later living tie.");
    const illegal = payAndPublish("Removed loudest.");
    addReactions(earlier.messageId, 80);
    addReactions(later.messageId, 80);
    addReactions(illegal.messageId, 120);
    closeForReview();
    moderateSimulatedMessage({ messageId: illegal.messageId, action: "remove" });
    const ranked = assignFinalRanks(simulatedMessageList());
    expect(ranked.find((row) => row.publicNumber === earlier.publicNumber)?.finalRank).toBe(1);
    expect(ranked.find((row) => row.publicNumber === later.publicNumber)?.finalRank).toBe(2);
    await discloseResults();
    expect(monumentCatalog()[0]?.originalPublicNumber).toBe(earlier.publicNumber);
  });

  it("issues a #1 certificate to the living sentence after the leader is removed", async () => {
    const { living, illegal } = leadPair();
    closeForReview();
    moderateSimulatedMessage({ messageId: illegal.messageId, action: "remove" });
    await discloseResults();
    const certificate = lookupSimulatedCertificate(living.wallKey);
    expect(certificate?.finalRank).toBe(1);
    expect(certificate?.text).toBe(living.text);
    expect(certificate?.publicNumber).toBe(living.publicNumber);
    expect(claimWithKey(living.publicNumber, living.wallKey).won).toBe(true);
    expect(claimWithKey(illegal.publicNumber, illegal.wallKey).won).toBe(false);
  });

  it("redacts a sealed Victor without moving the plot or the rank", async () => {
    const { living, illegal } = leadPair();
    await discloseResults();
    const before = monumentCatalog()[0];
    expect(before?.originalPublicNumber).toBe(illegal.publicNumber);
    expect(before?.text).toBe(illegal.text);
    moderateSimulatedMessage({ messageId: illegal.messageId, action: "remove" });
    const after = monumentCatalog()[0];
    expect(after?.originalPublicNumber).toBe(illegal.publicNumber);
    expect(after?.position).toBe(before?.position);
    expect(after?.x).toBe(before?.x);
    expect(after?.y).toBe(before?.y);
    expect(after?.text).toBe(ARCHIVAL_REMOVAL_TEXT);
    expect(after?.isRemoved).toBe(true);
    expect(listSimulatedEditions()[0]?.winning?.publicNumber).toBe(illegal.publicNumber);
    expect(listSimulatedEditions()[0]?.winning?.isRemoved).toBe(true);
    const livingRow = listSimulatedMessages({
      sort: "hot",
      limit: 48,
      finalized: true,
    }).messages.find((row) => row.publicNumber === living.publicNumber);
    expect(livingRow?.finalRank).not.toBe(1);
  });

  it("does not recarve after restoring a sealed Victor", async () => {
    const { illegal } = leadPair();
    await discloseResults();
    const plot = monumentCatalog()[0];
    moderateSimulatedMessage({ messageId: illegal.messageId, action: "remove" });
    moderateSimulatedMessage({ messageId: illegal.messageId, action: "restore" });
    const after = monumentCatalog()[0];
    expect(after?.originalPublicNumber).toBe(plot?.originalPublicNumber);
    expect(after?.position).toBe(plot?.position);
    expect(after?.text).toBe(illegal.text);
  });

  it("does not name a removed sentence as Victor when every sentence is removed", async () => {
    openShortLiveWall();
    const last = payAndPublish("Last living line.");
    addReactions(last.messageId, 90);
    closeForReview();
    for (const row of simulatedMessageList().filter((message) => !message.isRemoved)) {
      moderateSimulatedMessage({ messageId: row.id, action: "remove" });
    }
    await discloseResults();
    expect(monumentCatalog()).toHaveLength(0);
    const winning = listSimulatedEditions()[0]?.winning;
    expect(winning == null || winning.isRemoved !== true).toBe(true);
    expect(winning?.text).not.toBe(ARCHIVAL_REMOVAL_TEXT);
  });

  it("still names the removed loudest sentence as Most 🔥 while Victor is living", () => {
    const { living, illegal } = leadPair();
    closeForReview();
    moderateSimulatedMessage({ messageId: illegal.messageId, action: "remove" });
    const ranked = assignFinalRanks(simulatedMessageList());
    const records = recordsFromMessages(1, currentSimulatedEvent(), ranked);
    expect(records.winning?.publicNumber).toBe(living.publicNumber);
    expect(records.mostReacted?.publicNumber).toBe(illegal.publicNumber);
    expect(records.mostReacted?.isRemoved).toBe(true);
  });

  it("rejects empty, overlong, and control-character sentences", () => {
    expect(() => validateMessage("")).toThrow(AppError);
    expect(() => validateMessage("   ")).toThrow(AppError);
    expect(() => validateMessage("x".repeat(141))).toThrow(AppError);
    expect(validateMessage("  Stay.  ")).toBe("Stay.");
    expect(validateMessage("ありがとう。")).toBe("ありがとう。");
    expect(validateMessage("We stayed 🔥")).toMatch(/🔥/);
  });
});
