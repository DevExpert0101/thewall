import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));
import { Countdown } from "@/components/countdown";
import { Faq } from "@/components/faq";
import { FireButton } from "@/components/fire-button";
import { MessageComposer } from "@/components/message-composer";
import { PrimaryCta } from "@/components/primary-cta";
import { SharePanel } from "@/components/share-panel";
import { WatchDeck } from "@/components/watch-deck";
import { countdownLiveBucket, countdownSpokenName } from "@/lib/event/remaining";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

describe("keyboard access", () => {
  it("can tab to the live publish CTA and activate it", async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(<PrimaryCta phase="live" onPublish={() => { clicked = true; }} />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(clicked).toBe(true);
  });

  it("can open FAQ items from the keyboard", async () => {
    const user = userEvent.setup();
    const { getByText } = render(<Faq />);
    const trigger = getByText(/what is the wall/i);
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(getByText(/24-hour anonymous monument/i)).toBeInTheDocument();
  });
});

describe("countdown announcements", () => {
  it("does not put ticking seconds in the live region", () => {
    const hour = 12 * 3600 * 1000 + 42 * 60 * 1000 + 9_000;
    const later = 12 * 3600 * 1000 + 42 * 60 * 1000 + 1_000;
    expect(countdownLiveBucket(hour)).toBe(countdownLiveBucket(later));
    expect(countdownSpokenName("Remaining", hour)).not.toMatch(/second/i);

    render(
      <Countdown
        targetIso="2026-08-13T18:00:00.000Z"
        serverNow="2026-08-13T06:00:00.000Z"
        nowMs={Date.parse("2026-08-13T06:00:00.000Z")}
        label="Remaining"
        phase="live"
      />,
    );
    const live = document.querySelector("[aria-live='polite']");
    expect(live?.textContent).toMatch(/12 hours remaining/i);
    expect(live?.textContent).not.toMatch(/second/i);
    expect(screen.getByRole("group", { name: /12 hours/i })).toBeInTheDocument();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });
});

describe("share and watch", () => {
  it("announces copy once, not as a ticking status", () => {
    render(
      <SharePanel
        payload={{
          title: "THE WALL",
          text: "A sentence.",
          path: "/message/1",
          url: "http://localhost:3000/message/1",
        }}
        via="detail"
      />,
    );
    const live = document.querySelector("[aria-live='polite']");
    expect(live).toHaveClass("sr-only");
    expect(live).toHaveTextContent("");
  });

  it("exposes spectator modes as a keyboard tablist", () => {
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
      totalMessages: 2,
      totalReactions: 4,
      treasuryAddress: null,
      network: "base-sepolia",
      priceUsdc: "1.00",
    };
    const message: PublicMessage = {
      id: "00000000-0000-4000-8000-000000000001",
      eventId: "local",
      publicNumber: 1,
      text: "A sentence on the wall.",
      isRemoved: false,
      reactionCount: 2,
      publishedAt: "2026-08-13T10:00:00.000Z",
      finalRank: null,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ messages: [message], phase: "live" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
    render(<WatchDeck event={event} initial={[message]} mode="auto" />);
    vi.unstubAllGlobals();
    expect(screen.getByRole("tablist", { name: /spectator modes/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /auto wall/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-live", "off");
  });
});

describe("reaction and composer labels", () => {
  it("names the fire control for assistive tech", () => {
    render(<FireButton messageId="00000000-0000-4000-8000-000000000001" count={4} />);
    const button = screen.getByRole("button", { name: /react with fire/i });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the character count off the live region until the sentence is over", () => {
    const { rerender } = render(<MessageComposer value="short" onChange={() => undefined} />);
    expect(screen.getByText(/5 \/ 140/)).toHaveAttribute("aria-live", "off");
    rerender(
      <MessageComposer
        value={"x".repeat(141)}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByText(/141 \/ 140/)).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByLabelText(/your sentence/i)).toHaveAttribute("aria-invalid", "true");
  });
});
