import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RandomMode } from "@/components/random-mode";
import { SHOW_ANOTHER_HUMAN } from "@/lib/wall/random";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

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

function json(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/messages/random")) {
        if (url.includes("exclude=18")) {
          return json({ messages: [message(7)], remaining: 16, total: 18 });
        }
        return json({ messages: [message(18), message(7)], remaining: 16, total: 18 });
      }
      return json({ ok: true });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("random mode", () => {
  it("opens a sentence with number, edition, share, react, and another human", async () => {
    const user = userEvent.setup();
    render(
      <RandomMode event={event} initial={[message(18), message(7)]} variant="page" />,
    );
    expect(screen.getAllByText(/message #000018/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/the wall/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/sentence 18 on the wall/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /react with fire/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: SHOW_ANOTHER_HUMAN })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: SHOW_ANOTHER_HUMAN }));
    expect(await screen.findByText(/sentence 7 on the wall/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(
        vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("exclude=") && String(url).includes("18")),
      ).toBe(true);
    });
  });
});
