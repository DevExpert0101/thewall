import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LandingHero } from "@/components/landing-hero";
import { HERO_PITCH } from "@/lib/constants";
import type { EventSnapshot, PublicMessage } from "@/lib/types";

function event(extra: Partial<EventSnapshot> = {}): EventSnapshot {
  return {
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
    ...extra,
  };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ phase: "live", serverNow: "2026-08-16T20:00:00.000Z" }), {
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

describe("landing event states", () => {
  it("shows opening time, concept, remind, and share before the wall opens", () => {
    render(
      <LandingHero
        event={event({
          phase: "upcoming",
          serverNow: "2026-08-16T12:00:00.000Z",
          totalMessages: 0,
          totalReactions: 0,
        })}
      />,
    );
    expect(screen.getByText(/opens august 16, 2026/i)).toBeInTheDocument();
    for (const line of HERO_PITCH) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: /remind me/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /watch the wall/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share the opening/i })).toBeInTheDocument();
    expect(screen.getByText(/the waiting room is open/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Wall totals")).toHaveTextContent("Soon");
    expect(screen.queryByRole("button", { name: /leave your mark/i })).not.toBeInTheDocument();
  });

  it("treats a blank live wall as the first hundred, not empty failure", () => {
    render(
      <LandingHero
        event={event({
          totalMessages: 0,
          totalReactions: 0,
        })}
      />,
    );
    expect(screen.getByText(/the wall has just opened/i)).toBeInTheDocument();
    expect(screen.getByText(/you could be one of the first 100 voices/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /leave your mark — \$1/i })).toBeInTheDocument();
    expect(screen.queryByText(/thousands of viewers/i)).not.toBeInTheDocument();
  });

  it("keeps the lower totals in lockstep with the live pulse", async () => {
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            phase: "live",
            serverNow: "2026-08-16T20:00:00.000Z",
            totalMessages: 19,
            totalReactions: 405,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );
    render(
      <LandingHero
        event={event({
          phase: "upcoming",
          serverNow: "2026-08-16T12:00:00.000Z",
          totalMessages: 0,
          totalReactions: 0,
        })}
      />,
    );
    await waitFor(() => {
      expect(screen.getAllByText("19")).toHaveLength(2);
      expect(screen.getAllByText("405")).toHaveLength(2);
    });
    expect(screen.getByLabelText("Wall totals")).toHaveTextContent("Open");
  });

  it("explains the product in the first screen while live", () => {
    render(<LandingHero event={event()} />);
    expect(screen.getByRole("heading", { name: /the\s*wall/i })).toBeInTheDocument();
    expect(screen.getByText("ONE DAY.")).toBeInTheDocument();
    expect(screen.getByText("ONE DOLLAR.")).toBeInTheDocument();
    expect(screen.getByText("ONE SENTENCE.")).toBeInTheDocument();
    for (const line of HERO_PITCH) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
    expect(screen.getByText(/happening now/i)).toBeInTheDocument();
    expect(screen.getAllByText("12").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("40").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText("Wall totals")).toHaveTextContent("Open");
    expect(screen.getByRole("button", { name: /leave your mark — \$1/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /watch the wall/i })).toBeInTheDocument();
    expect(screen.getByText(/reading is free/i)).toBeInTheDocument();
    expect(screen.queryByText(/usdc/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bbase\b/i)).not.toBeInTheDocument();
  });

  it("puts a real carved sentence next to the $1 action", () => {
    const featured: PublicMessage = {
      id: "m-4",
      eventId: "local",
      publicNumber: 4,
      text: "If you are reading this in fifty years, I drove a night bus and I liked the quiet.",
      isRemoved: false,
      reactionCount: 67,
      publishedAt: "2026-08-16T16:00:00.000Z",
      finalRank: null,
    };
    render(<LandingHero event={event()} featured={featured} />);
    expect(screen.getByText(/fifty years/i)).toBeInTheDocument();
    expect(screen.getByText(/the wall №001 \/ message #000004/i)).toBeInTheDocument();
    expect(screen.getByText(/67 🔥/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /leave your mark — \$1/i })).toBeInTheDocument();
    expect(screen.queryByText(/sample composition/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/usdc/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bbase\b/i)).not.toBeInTheDocument();
  });

  it("raises the remaining-time notice in the final hour", () => {
    render(
      <LandingHero
        event={event({
          endsAt: "2026-08-16T20:45:00.000Z",
          serverNow: "2026-08-16T20:00:00.000Z",
        })}
      />,
    );
    expect(screen.getByText("45 MINUTES REMAIN.")).toBeInTheDocument();
    expect(screen.getByText(/the last hour is open/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /leave your mark/i })).toBeInTheDocument();
  });

  it("uses a dedicated last-minute countdown", () => {
    render(
      <LandingHero
        event={event({
          endsAt: "2026-08-16T20:00:40.000Z",
          serverNow: "2026-08-16T20:00:00.000Z",
        })}
      />,
    );
    expect(screen.getByText("40 SECONDS REMAIN.")).toBeInTheDocument();
    expect(screen.getByText(/the wall closes now/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /final seconds/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /leave your mark/i })).toBeInTheDocument();
    expect(document.querySelector("audio")).toBeNull();
  });

  it("shows each of the last ten seconds as a single number", () => {
    render(
      <LandingHero
        event={event({
          endsAt: "2026-08-16T20:00:08.000Z",
          serverNow: "2026-08-16T20:00:00.000Z",
        })}
      />,
    );
    expect(screen.getByText("8 SECONDS REMAIN.")).toBeInTheDocument();
    expect(document.querySelector("[data-presentation='final-seconds']")).toBeTruthy();
    expect(document.querySelector(".countdown-final-seconds")?.textContent).toBe("8");
    expect(screen.getByRole("button", { name: /leave your mark/i })).toBeInTheDocument();
  });

  it("freezes at zero with the close monument and no archive door", () => {
    render(
      <LandingHero
        event={event({
          phase: "finalizing",
          endsAt: "2026-08-16T20:00:00.000Z",
          serverNow: "2026-08-16T20:00:00.000Z",
          totalMessages: 428193,
        })}
      />,
    );
    expect(screen.getByText(/the wall №001 has closed/i)).toBeInTheDocument();
    expect(screen.getByText("428,193 PEOPLE SPOKE.")).toBeInTheDocument();
    expect(screen.getByText(/no one can add another word/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /enter the archive/i })).not.toBeInTheDocument();
    expect(screen.getByText(/final ranks are not public yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /leave your mark/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /final seconds/i })).not.toBeInTheDocument();
  });

  it("does not reopen from a delayed live snapshot after the clock has closed", async () => {
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ phase: "live", serverNow: "2026-08-16T20:00:02.000Z" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    render(
      <LandingHero
        event={event({
          phase: "finalizing",
          endsAt: "2026-08-16T20:00:00.000Z",
          serverNow: "2026-08-16T20:00:01.000Z",
          totalMessages: 12,
        })}
      />,
    );
    expect(screen.getByText(/the wall №001 has closed/i)).toBeInTheDocument();
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("/api/event"))).toBe(true);
    });
    expect(screen.getByText(/the wall №001 has closed/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /leave your mark/i })).not.toBeInTheDocument();
  });

  it("leaves a sealed Wall when the next day is already live", async () => {
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            phase: "live",
            serverNow: "2026-08-16T21:00:00.000Z",
            startsAt: "2026-08-16T20:50:00.000Z",
            endsAt: "2026-08-16T21:50:00.000Z",
            editionNumber: 6,
            totalMessages: 0,
            totalReactions: 0,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );
    render(
      <LandingHero
        event={event({
          phase: "archived",
          editionNumber: 5,
          endsAt: "2026-08-16T20:00:00.000Z",
          startsAt: "2026-08-16T19:00:00.000Z",
          serverNow: "2026-08-16T20:10:00.000Z",
          totalMessages: 20,
        })}
      />,
    );
    expect(screen.getByText(/the wall №005 has closed/i)).toBeInTheDocument();
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /leave your mark/i })).toBeInTheDocument();
    });
    expect(screen.queryByText(/the wall №005 has closed/i)).not.toBeInTheDocument();
  });
});
