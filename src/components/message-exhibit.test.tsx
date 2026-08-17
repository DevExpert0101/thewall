import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageExhibit } from "@/components/message-exhibit";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

const event: EventSnapshot = {
  id: "local",
  slug: "the-wall",
  title: "THE WALL",
  startsAt: "2026-08-16T18:00:00.000Z",
  endsAt: "2026-08-17T18:00:00.000Z",
  archivedAt: null,
  finalizedAt: null,
  phase: "live",
  serverNow: "2026-08-16T20:00:00.000Z",
  totalMessages: 12,
  totalReactions: 40,
  treasuryAddress: null,
  network: "base-sepolia",
  priceUsdc: "1.00",
  editionNumber: 1,
};

const message: PublicMessage = {
  id: "m4",
  eventId: "local",
  publicNumber: 4,
  text: "If you are reading this in fifty years, we hoped.",
  isRemoved: false,
  reactionCount: 67,
  publishedAt: "2026-08-16T19:00:00.000Z",
  finalRank: null,
};

describe("message exhibit", () => {
  it("can be screenshotted as the sentence, not an advertisement", () => {
    render(<MessageExhibit event={event} message={message} />);
    expect(screen.getByText("THE WALL")).toBeInTheDocument();
    expect(screen.getByText(/the wall №001 \/ message #000004/i)).toBeInTheDocument();
    expect(screen.getByText(/if you are reading this in fifty years/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /react with fire/i })).toBeInTheDocument();
    expect(screen.getAllByText(/67/).length).toBeGreaterThan(0);
    expect(screen.getByRole("group", { name: /remaining|closed/i })).toBeInTheDocument();
    expect(screen.getByText(/67 🔥 · on this wall now/i)).toBeInTheDocument();
    expect(screen.queryByText(/one day\. one dollar/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/connect wallet/i)).not.toBeInTheDocument();
  });

  it("shows a sealed mark instead of a clock after the wall closes", () => {
    render(
      <MessageExhibit
        event={{ ...event, phase: "archived", archivedAt: event.endsAt }}
        message={{ ...message, finalRank: 2 }}
      />,
    );
    expect(screen.getByText("Sealed")).toBeInTheDocument();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    expect(screen.getByText(/final rank #2/i)).toBeInTheDocument();
  });
});
