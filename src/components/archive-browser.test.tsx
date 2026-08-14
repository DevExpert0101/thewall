import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArchiveBrowser } from "@/components/archive-browser";
import { ARCHIVAL_REMOVAL_TEXT } from "@/lib/constants";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

const event: EventSnapshot = {
  id: "local",
  slug: "the-wall",
  title: "THE WALL",
  startsAt: "2026-08-12T18:00:00.000Z",
  endsAt: "2026-08-13T18:00:00.000Z",
  archivedAt: "2026-08-13T18:00:00.000Z",
  finalizedAt: "2026-08-13T18:00:05.000Z",
  phase: "archived",
  serverNow: "2026-08-13T19:00:00.000Z",
  totalMessages: 2,
  totalReactions: 12,
  treasuryAddress: null,
  network: "base-sepolia",
  priceUsdc: "1.00",
};

function message(n: number, extra: Partial<PublicMessage> = {}): PublicMessage {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    eventId: "local",
    publicNumber: n,
    text: `Sentence ${n}.`,
    isRemoved: false,
    reactionCount: n,
    publishedAt: "2026-08-13T10:00:00.000Z",
    finalRank: n,
    ...extra,
  };
}

describe("archive browser", () => {
  it("is read-only and searchable by number", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = new URL(String(input), "http://localhost");
        if (url.searchParams.get("q") === "#000004") {
          return Promise.resolve(
            new Response(
              JSON.stringify({ messages: [message(4, { finalRank: 1 })], nextCursor: null }),
              { headers: { "Content-Type": "application/json" } },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [], nextCursor: null }), {
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );
    render(
      <ArchiveBrowser
        event={event}
        initial={[
          message(4, { finalRank: 1 }),
          message(8, { text: ARCHIVAL_REMOVAL_TEXT, isRemoved: true, finalRank: 2 }),
        ]}
      />,
    );
    expect(screen.getByText(/rank #1/i)).toBeInTheDocument();
    expect(screen.getByText(ARCHIVAL_REMOVAL_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /leave your mark/i })).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("#004291"), "#000004");
    await user.click(screen.getByRole("button", { name: /^find$/i }));
    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("q=%23000004") || String(url).includes("q=#000004"))).toBe(true);
    });
    vi.unstubAllGlobals();
  });

  it("hides removed sentences without dropping their numbers from the monument", async () => {
    const user = userEvent.setup();
    render(
      <ArchiveBrowser
        event={event}
        initial={[
          message(1, { finalRank: 1 }),
          message(8, { text: ARCHIVAL_REMOVAL_TEXT, isRemoved: true, finalRank: 2 }),
        ]}
      />,
    );
    expect(screen.getByText(/rank #2/i)).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /hide removed/i }));
    expect(screen.queryByText(ARCHIVAL_REMOVAL_TEXT)).not.toBeInTheDocument();
    expect(screen.getByText(/sentence 1/i)).toBeInTheDocument();
  });
});
