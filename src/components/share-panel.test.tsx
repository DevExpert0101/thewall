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
    expect(screen.getByRole("link", { name: /1200×630/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/api/creatives"),
    );
    expect(screen.getByRole("link", { name: /1200×630/i })).toHaveAttribute(
      "href",
      expect.stringContaining("ratio=1200x630"),
    );
    expect(screen.getByRole("link", { name: /square card/i })).toHaveAttribute(
      "href",
      expect.stringContaining("ratio=1%3A1"),
    );
    expect(screen.getByRole("link", { name: /portrait card/i })).toHaveAttribute(
      "href",
      expect.stringContaining("ratio=9%3A16"),
    );
  });

  it("can preview the generated share text without posting it", () => {
    render(
      <SharePanel
        payload={sharePayloadForMessage({ event, message })}
        via="publish"
        preview
      />,
    );
    expect(screen.getByText(/“I hope we were trying.”/)).toBeInTheDocument();
    expect(screen.getByText(/Message #004291 on The Wall №001/)).toBeInTheDocument();
    expect(screen.queryByText(/find me before history freezes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/get your message seen/i)).not.toBeInTheDocument();
  });
});
