import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SharePanel } from "@/components/share-panel";
import { sharePayloadForMessage } from "@/lib/share/copy";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

const event: EventSnapshot = {
  id: "evt",
  slug: "the-wall",
  title: "THE WALL",
  startsAt: "2026-08-12T18:00:00.000Z",
  endsAt: "2026-08-13T18:00:00.000Z",
  archivedAt: null,
  finalizedAt: null,
  phase: "live",
  serverNow: "2026-08-13T12:00:00.000Z",
  totalMessages: 18,
  totalReactions: 401,
  treasuryAddress: null,
  network: "base-sepolia",
  priceUsdc: "1.00",
};

const message: PublicMessage = {
  id: "m",
  eventId: "evt",
  publicNumber: 4291,
  text: "I hope we were trying.",
  isRemoved: false,
  reactionCount: 12,
  publishedAt: "2026-08-13T10:00:00.000Z",
  finalRank: null,
};

describe("SharePanel", () => {
  it("offers copy-link plus X, Telegram, Reddit, and Discord", () => {
    render(
      <SharePanel
        payload={sharePayloadForMessage({ event, message })}
        via="detail"
        primaryLabel="Share this sentence"
      />,
    );
    expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /post on x/i })).toHaveAttribute(
      "href",
      expect.stringContaining("twitter.com/intent/tweet"),
    );
    expect(screen.getByRole("link", { name: /telegram/i })).toHaveAttribute(
      "href",
      expect.stringContaining("t.me/share/url"),
    );
    expect(screen.getByRole("link", { name: /reddit/i })).toHaveAttribute(
      "href",
      expect.stringContaining("reddit.com/submit"),
    );
    expect(screen.getByRole("button", { name: /discord/i })).toBeInTheDocument();
  });
});
