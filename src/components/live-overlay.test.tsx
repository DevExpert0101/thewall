import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveOverlay } from "@/components/live-overlay";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

function message(n: number, extra: Partial<PublicMessage> = {}): PublicMessage {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    eventId: "local",
    publicNumber: n,
    text: `Sentence ${n} on the wall.`,
    isRemoved: false,
    reactionCount: n * 10,
    publishedAt: "2026-08-13T12:00:00.000Z",
    finalRank: null,
    ...extra,
  };
}

const event: EventSnapshot = {
  id: "local",
  slug: "the-wall",
  title: "THE WALL",
  startsAt: "2026-08-13T00:00:00.000Z",
  endsAt: "2026-08-14T00:00:00.000Z",
  archivedAt: null,
  finalizedAt: null,
  phase: "live",
  serverNow: "2026-08-13T12:00:00.000Z",
  totalMessages: 20,
  totalReactions: 80,
  treasuryAddress: null,
  network: "base-sepolia",
  priceUsdc: "1.00",
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ messages: [message(7)], phase: "live" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("live overlay", () => {
  it("shows #1, rising, random, and the countdown without site chrome", () => {
    render(
      <LiveOverlay
        event={event}
        initial={{
          leader: message(4, { reactionCount: 80 }),
          rising: [message(11), message(8)],
          random: message(19),
        }}
        cycleSec={14}
      />,
    );

    expect(screen.getByText(/current #1/i)).toBeInTheDocument();
    expect(screen.getByText(/sentence 4 on the wall/i)).toBeInTheDocument();
    expect(screen.getByText(/by fire · provisional/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/rising sentences/i)).toBeInTheDocument();
    expect(screen.getByText(/sentence 11 on the wall/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/random sentence/i)).toBeInTheDocument();
    expect(screen.getByText(/sentence 19 on the wall/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /remaining/i })).toBeInTheDocument();
    expect(screen.getByText(/never shows wallets or keys/i)).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /about/i })).not.toBeInTheDocument();
    expect(document.querySelector("audio")).toBeNull();
    expect(document.querySelector("video")).toBeNull();
  });

  it("names a sealed victor instead of a provisional leader", () => {
    render(
      <LiveOverlay
        event={{ ...event, phase: "archived", finalizedAt: "2026-08-14T00:05:00.000Z" }}
        initial={{
          leader: message(4, { finalRank: 1, reactionCount: 80 }),
          rising: [],
          random: message(19),
        }}
        cycleSec={14}
      />,
    );

    expect(screen.getByText(/the victor/i)).toBeInTheDocument();
    expect(screen.queryByText(/provisional/i)).not.toBeInTheDocument();
  });
});
