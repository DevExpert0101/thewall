import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WatchDeck } from "@/components/watch-deck";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

function message(n: number, extra: Partial<PublicMessage> = {}): PublicMessage {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    eventId: "local",
    publicNumber: n,
    text: `Sentence ${n} on the wall.`,
    isRemoved: false,
    reactionCount: n,
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
  totalMessages: 18,
  totalReactions: 40,
  treasuryAddress: null,
  network: "base-sepolia",
  priceUsdc: "1.00",
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ messages: [message(4)], phase: "live" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("spectator deck", () => {
  it("shows branding, countdown, numbers, and the four watch modes", () => {
    render(
      <WatchDeck
        event={event}
        initial={[message(18), message(4)]}
        mode="auto"
      />,
    );
    expect(screen.getByText(/the wall №001/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /remaining/i })).toBeInTheDocument();
    expect(screen.getByText("#000018")).toBeInTheDocument();
    expect(screen.getByText(/sentence 18 on the wall/i)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /auto wall/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^rising$/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^random$/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /top 10/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /stream mode/i })).toHaveAttribute("href", "/live");
    expect(document.querySelector("audio")).toBeNull();
    expect(document.querySelector("video")).toBeNull();
  });

  it("keeps stream mode free of site navigation and pay chrome", () => {
    render(
      <WatchDeck
        event={event}
        initial={[message(7)]}
        mode="random"
        stream
        cycleSec={12}
      />,
    );
    expect(screen.getByText(/message #000007/i)).toBeInTheDocument();
    expect(screen.getByText(/anyone can read/i)).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /stream mode/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /leave your mark/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /react with fire/i })).not.toBeInTheDocument();
  });

  it("can switch to the leaderboard", async () => {
    const user = userEvent.setup();
    replace.mockClear();
    render(<WatchDeck event={event} initial={[message(4)]} mode="auto" />);
    await user.click(screen.getByRole("tab", { name: /top 10/i }));
    expect(replace).toHaveBeenCalledWith("/watch?mode=top");
  });

  it("does not apply a delayed list refresh after close", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ messages: [message(99)], phase: "live" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    render(
      <WatchDeck
        event={{
          ...event,
          phase: "finalizing",
          endsAt: "2026-08-13T12:00:00.000Z",
          serverNow: "2026-08-13T12:00:01.000Z",
        }}
        initial={[message(18)]}
        mode="auto"
      />,
    );
    expect(screen.getByText(/sentence 18 on the wall/i)).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(screen.getByText(/sentence 18 on the wall/i)).toBeInTheDocument();
    expect(screen.queryByText(/sentence 99 on the wall/i)).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
