import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WaitingRoom } from "@/components/waiting-room";
import type { EventSnapshot } from "@/lib/types";

function event(extra: Partial<EventSnapshot> = {}): EventSnapshot {
  return {
    id: "local",
    slug: "the-wall",
    title: "THE WALL",
    startsAt: "2026-08-16T18:00:00.000Z",
    endsAt: "2026-08-17T18:00:00.000Z",
    archivedAt: null,
    finalizedAt: null,
    phase: "upcoming",
    serverNow: "2026-08-16T12:00:00.000Z",
    totalMessages: 0,
    totalReactions: 0,
    treasuryAddress: null,
    network: "base-sepolia",
    priceUsdc: "1.00",
    editionNumber: 1,
    ...extra,
  };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ phase: "upcoming", serverNow: "2026-08-16T12:00:00.000Z", totalMessages: 0 }), {
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

describe("waiting room", () => {
  it("is a shareable pre-launch room with a real opening time", () => {
    render(<WaitingRoom event={event()} />);
    expect(screen.getByRole("heading", { name: /the waiting room is open/i })).toBeInTheDocument();
    expect(screen.getByText(/opens august 16, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/no sentences have been carved/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /remind me/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /watch the wall/i })).toHaveAttribute("href", "/watch");
    expect(screen.getByRole("link", { name: /stream mode/i })).toHaveAttribute("href", "/live");
    expect(screen.getByRole("button", { name: /share the opening/i })).toBeInTheDocument();
    expect(screen.queryByText(/viewers/i)).not.toBeInTheDocument();
  });

  it("marks an invited creator without granting a special right", () => {
    render(<WaitingRoom event={event()} invited />);
    expect(screen.getByText(/you were invited to be here when it opens/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /leave your mark/i })).not.toBeInTheDocument();
  });

  it("uses first-hundred scarcity once the wall is live and still blank", () => {
    render(
      <WaitingRoom
        event={event({
          phase: "live",
          serverNow: "2026-08-16T18:05:00.000Z",
        })}
      />,
    );
    expect(screen.getByRole("heading", { name: /the wall has just opened/i })).toBeInTheDocument();
    expect(screen.getByText(/you could be one of the first 100 voices/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /leave your mark — \$1/i })).toBeInTheDocument();
  });
});
