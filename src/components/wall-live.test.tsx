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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("live wall", () => {
  it("renders the live feed without requiring payment", () => {
    render(<WallLive event={event} initial={[message(4), message(3)]} initialCursor="12" />);
    expect(screen.getByText(/live/i)).toBeInTheDocument();
    expect(screen.getByText(/sentence 4 on the wall/i)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /rising/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /most/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /new/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /random/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /hidden gems/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /final hour/i })).toBeInTheDocument();
    expect(screen.getByText(/find a sentence/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /find/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /load more sentences/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view the wall/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /shuffle/i })).not.toBeInTheDocument();
  });

  it("opens the visual wall from a button and can return to the sentence list", async () => {
    const user = userEvent.setup();
    const rising = message(15);
    const fresh = message(18);
    const wander = message(3);
    render(
      <WallLive
        event={event}
        initial={[rising, fresh, wander]}
        initialLanes={{ [rising.id]: "rising", [fresh.id]: "fresh", [wander.id]: "surprise" }}
      />,
    );
    expect(screen.getByText(/^just in$/i)).toBeInTheDocument();
    expect(screen.getByText(/^wander$/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /the wall/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /view the wall/i }));
    expect(screen.getByRole("dialog", { name: /the wall/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sentence 15 on the wall/i })).toHaveAttribute(
      "href",
      "/message/15",
    );
    await user.click(screen.getByRole("button", { name: /back to sentences/i }));
    expect(screen.queryByRole("dialog", { name: /the wall/i })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /rising/i })).toBeInTheDocument();
  });

  it("opens fullscreen random mode from the random tab", async () => {
    const user = userEvent.setup();
    render(<WallLive event={event} initial={[message(4)]} />);
    await user.click(screen.getByRole("tab", { name: /random/i }));
    expect(await screen.findByRole("button", { name: /show me another human/i })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /random/i })).toBeInTheDocument();
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
    await user.type(screen.getByPlaceholderText(/#004291/), "#000099");
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
    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("mix=1"))).toBe(true);
    });
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

  it("does not disclose results while the wall is under review", () => {
    render(
      <WallLive
        event={{ ...event, phase: "finalizing", endsAt: "2026-08-13T12:00:00.000Z" }}
        initial={[message(4)]}
      />,
    );
    expect(screen.getByText(/the wall №001 has closed/i)).toBeInTheDocument();
    expect(screen.getByText("18 PEOPLE SPOKE.")).toBeInTheDocument();
    expect(screen.getByText(/no one can add another word/i)).toBeInTheDocument();
    expect(screen.getByText(/under review/i)).toBeInTheDocument();
    expect(screen.getByText(/final ranks are not public yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/^finalizing$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /enter the archive/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /leave your mark/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /react with fire/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /rising/i })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /most/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /hidden gems/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /final hour/i })).toBeInTheDocument();
  });

  it("does not treat an upcoming wall as frozen", () => {
    render(
      <WallLive
        event={{ ...event, phase: "upcoming", startsAt: "2026-08-14T00:00:00.000Z" }}
        initial={[]}
      />,
    );
    expect(screen.getAllByText(/until launch/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/blank stone/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /remind me/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share the opening/i })).toBeInTheDocument();
    expect(screen.queryByText(/the wall is frozen/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /enter the archive/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /leave your mark/i })).not.toBeInTheDocument();
  });

  it("ignores a delayed pulse after the clock has closed", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/messages/pulse") || url.includes("/api/event")) {
        return json({
          phase: "live",
          serverNow: "2026-08-13T12:00:02.000Z",
          totalMessages: 99,
          totalReactions: 200,
          latestPublicNumber: 99,
          counts: {},
        });
      }
      if (url.includes("/api/messages")) {
        return json({ messages: [message(99)], nextCursor: null });
      }
      return json({ ok: true });
    });
    render(
      <WallLive
        event={{
          ...event,
          phase: "finalizing",
          endsAt: "2026-08-13T12:00:00.000Z",
          serverNow: "2026-08-13T12:00:01.000Z",
        }}
        initial={[message(4)]}
      />,
    );
    expect(screen.getByText(/sentence 4 on the wall/i)).toBeInTheDocument();
    expect(screen.getByText("18 PEOPLE SPOKE.")).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(35_000);
    expect(screen.getByText(/sentence 4 on the wall/i)).toBeInTheDocument();
    expect(screen.queryByText(/sentence 99 on the wall/i)).not.toBeInTheDocument();
    expect(screen.getByText("18 PEOPLE SPOKE.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /leave your mark/i })).not.toBeInTheDocument();
  });
});
