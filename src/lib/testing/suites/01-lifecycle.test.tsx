import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingHero } from "@/components/landing-hero";
import { MESSAGE_MAX_GRAPHEMES } from "@/lib/constants";
import { graphemeCount, validateMessage } from "@/lib/message/normalize";
import { assignFinalRanks } from "@/lib/ranking";
import { AppError } from "@/lib/errors";
import {
  addReactions,
  closeForReview,
  discloseResults,
  monumentCatalog,
  openShortLiveWall,
  openUpcomingWall,
  payAndPublish,
  reactOnce,
  resetAutomatedWall,
  sealAutomatedWall,
} from "@/lib/testing/harness";
import {
  createSimulatedIntent,
  currentSimulatedEvent,
  listSimulatedMessages,
  simulatedMessageList,
} from "@/lib/data/simulation";
import { createWallKey, hashWallKey } from "@/lib/crypto";
import { assertPublishOpen, assertReactOpen } from "@/lib/event/state";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } })),
    ),
  );
});

afterEach(() => {
  resetAutomatedWall();
  vi.unstubAllGlobals();
});

describe("suite 1 — complete Wall lifecycle", () => {
  it("shows upcoming: countdown on, writes and 🔥 off", () => {
    const event = openUpcomingWall();
    expect(event.phase).toBe("upcoming");
    expect(() => assertPublishOpen(event)).toThrow(AppError);
    expect(() => assertReactOpen(event)).toThrow(AppError);
    render(<LandingHero event={event} />);
    expect(screen.getAllByText(/until the wall opens/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /leave your mark/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /remind me/i })).toBeInTheDocument();
  });

  it("goes live, publishes A/B/C, ranks B then C then A, seals once", async () => {
    openShortLiveWall(5);
    const live = currentSimulatedEvent();
    expect(live.phase).toBe("live");
    render(<LandingHero event={live} />);
    expect(screen.getByRole("button", { name: /leave your mark/i })).toBeInTheDocument();

    expect(validateMessage("x".repeat(MESSAGE_MAX_GRAPHEMES))).toHaveLength(140);
    expect(graphemeCount("x".repeat(141))).toBe(141);
    expect(() => validateMessage("x".repeat(141))).toThrow(AppError);

    const a = payAndPublish("Lifecycle message A.");
    const b = payAndPublish("Lifecycle message B.");
    const c = payAndPublish("Lifecycle message C.");
    addReactions(a.messageId, 100);
    addReactions(b.messageId, 250);
    addReactions(c.messageId, 175);
    expect(a.publicNumber).not.toBe(b.publicNumber);
    expect(simulatedMessageList().some((row) => row.text === b.text)).toBe(true);
    expect(reactOnce(a.messageId, "local-sim-one-more-a")).toBeGreaterThan(100);

    const hot = listSimulatedMessages({ sort: "hot", limit: 10 }).messages;
    expect(hot[0]?.text).toBe(b.text);
    expect(hot[1]?.text).toBe(c.text);
    expect(hot[2]?.text).toBe(a.text);
    const ranked = assignFinalRanks(simulatedMessageList());
    expect(ranked.find((row) => row.text === b.text)?.finalRank).toBe(1);
    expect(ranked.find((row) => row.text === c.text)?.finalRank).toBe(2);
    expect(ranked.find((row) => row.text === a.text)?.finalRank).toBe(3);

    expect(closeForReview().phase).toBe("finalizing");
    expect(() =>
      createSimulatedIntent({
        text: "Too late to carve.",
        userId: "late",
        claimSecretHash: hashWallKey(createWallKey()),
      }),
    ).toThrow(AppError);
    expect(() => reactOnce(b.messageId, "late-fire")).toThrow(AppError);
    expect(simulatedMessageList().find((row) => row.text === b.text)?.text).toBe(b.text);

    const sealed = await discloseResults();
    expect(sealed.phase).toBe("archived");
    const carved = monumentCatalog();
    expect(carved).toHaveLength(1);
    expect(carved[0]?.text).toBe(b.text);
    expect(carved[0]?.position).toBe(1);
    expect(listSimulatedMessages({ sort: "hot", limit: 1 }).messages[0]?.finalRank).toBe(1);

    sealAutomatedWall();
    expect(monumentCatalog()).toHaveLength(1);
    expect(monumentCatalog()[0]?.text).toBe(b.text);
    expect(monumentCatalog()[0]?.position).toBe(1);
  });
});
