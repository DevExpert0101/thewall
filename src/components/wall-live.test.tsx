import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WallLive } from "@/components/wall-live";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

function message(n: number, extra: Partial<PublicMessage> = {}): PublicMessage {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    eventId: "local",
    publicNumber: n,
    text: `Sentence ${n} on the wall.`,
    isRemoved: false,
    reactionCount: n,
    publishedAt: new Date("2026-08-13T12:00:00.000Z").toISOString(),
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

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  class FakeObserver {
    observe() {}
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/messages/pulse") || url.includes("/api/event")) {
        return json({ counts: {}, totalMessages: 18, totalReactions: 40, phase: "live" });
      }
      if (url.includes("/api/messages")) {
        const parsed = new URL(url, "http://localhost");
        if (parsed.searchParams.get("q") === "#000099") {
          return json({ messages: [], nextCursor: null });
        }
        if (parsed.searchParams.get("sort") === "new") {
          return json({ messages: [message(18), message(17)], nextCursor: "16" });
        }
        if (parsed.searchParams.get("cursor")) {
          return json({ messages: [message(6), message(5)], nextCursor: null });
        }
        return json({ messages: [message(4), message(3)], nextCursor: "12" });
      }
      if (url.includes("/api/react")) {
        return json({ reactionCount: 5 });
      }
      return json({ ok: true });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("live wall", () => {
  it("renders the live feed without requiring payment", () => {
    render(<WallLive event={event} initial={[message(4), message(3)]} initialCursor="12" />);
    expect(screen.getByText(/live/i)).toBeInTheDocument();
    expect(screen.getByText(/sentence 4 on the wall/i)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /trending/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /most/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /new/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /random/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /load more sentences/i })).toBeInTheDocument();
  });

  it("loads the new feed when that filter is chosen", async () => {
    const user = userEvent.setup();
    render(<WallLive event={event} initial={[message(4)]} />);
    await user.click(screen.getByRole("tab", { name: /^new$/i }));
    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("sort=new"))).toBe(true);
    });
    expect(await screen.findByText(/sentence 18 on the wall/i)).toBeInTheDocument();
  });

  it("searches by public number and recovers from a miss", async () => {
    const user = userEvent.setup();
    render(<WallLive event={event} initial={[message(4)]} />);
    await user.type(screen.getByPlaceholderText("#004291"), "#000099");
    await user.click(screen.getByRole("button", { name: /^find$/i }));
    expect(await screen.findByText(/no 000099/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^clear$/i }));
    await waitFor(() => {
      expect(screen.getByText(/sentence 4 on the wall/i)).toBeInTheDocument();
    });
  });

  it("shows error recovery when the feed fails", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/messages?") && url.includes("sort=hot")) {
        return json({ error: "Unavailable", recovery: "Try again in a moment." }, 503);
      }
      return json({ messages: [message(1)], nextCursor: null });
    });
    render(<WallLive event={event} initial={[message(4)]} />);
    await user.click(screen.getByRole("tab", { name: /most/i }));
    expect(await screen.findByText(/try again in a moment/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("appends the next page instead of replacing the wall", async () => {
    const user = userEvent.setup();
    render(<WallLive event={event} initial={[message(4), message(3)]} initialCursor="12" />);
    await user.click(screen.getByRole("button", { name: /load more sentences/i }));
    expect(await screen.findByText(/sentence 6 on the wall/i)).toBeInTheDocument();
    expect(screen.getByText(/sentence 4 on the wall/i)).toBeInTheDocument();
  });

  it("hides removed sentences when filtered", async () => {
    const user = userEvent.setup();
    render(
      <WallLive
        event={event}
        initial={[
          message(1),
          message(8, { text: "Message removed under archive policy.", isRemoved: true }),
        ]}
      />,
    );
    expect(screen.getByText(/message removed under archive policy/i)).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /hide removed/i }));
    expect(screen.queryByText(/message removed under archive policy/i)).not.toBeInTheDocument();
    expect(screen.getByText(/sentence 1 on the wall/i)).toBeInTheDocument();
  });

  it("does not treat an upcoming wall as frozen", () => {
    render(
      <WallLive
        event={{ ...event, phase: "upcoming", startsAt: "2026-08-14T00:00:00.000Z" }}
        initial={[]}
      />,
    );
    expect(screen.getByText(/until launch/i)).toBeInTheDocument();
    expect(screen.getByText(/blank stone/i)).toBeInTheDocument();
    expect(screen.queryByText(/the wall is frozen/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /enter the archive/i })).not.toBeInTheDocument();
  });
});
