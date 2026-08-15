import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminDashboard } from "@/components/admin/dashboard";
import type { AdminOverview } from "@/lib/admin/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const overview: AdminOverview = {
  config: {
    title: "THE WALL",
    slug: "the-wall",
    phase: "live",
    startsAt: "2026-08-13T00:00:00.000Z",
    endsAt: "2026-08-14T00:00:00.000Z",
    archivedAt: null,
    finalizedAt: null,
    network: "base-sepolia",
    treasuryAddress: "0x00000000000000000000000000000000000000aa",
    priceUsdc: "1.00",
    totalMessages: 2,
    totalReactions: 1,
    editionNumber: 1,
    archiveHash: null,
    merkleRoot: null,
    archiveUri: null,
    proofTx: null,
    windowMinutes: 1440,
    remainingMinutes: 720,
  },
  totals: { messages: 2, reactions: 1, usdc: 2 },
  simulation: false,
  editions: [],
  feedback: [],
  recentFailures: [],
  openReports: [
    {
      id: "r1",
      messageId: "m1",
      publicNumber: 4,
      category: "spam",
      detail: null,
      status: "open",
      createdAt: "2026-08-13T12:00:00.000Z",
    },
  ],
  flaggedMessages: [],
  audit: [
    {
      id: "a1",
      messageId: "m1",
      publicNumber: 4,
      action: "remove",
      reason: "spam",
      administratorEmail: "ops@example.com",
      createdAt: "2026-08-13T12:01:00.000Z",
    },
  ],
  health: {
    database: "configured",
    privilegedDb: "configured",
    payments: "configured",
    turnstile: "configured",
    network: "base-sepolia",
    eventStatus: "live",
    moderation: "rules-v1",
  },
};

describe("admin dashboard", () => {
  it("lets a steward configure this Wall without exposing secret material", () => {
    const { container } = render(<AdminDashboard initial={overview} email="ops@example.com" />);
    expect(screen.getByText(/current edition/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /this wall/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^title$/i)).toHaveValue("THE WALL");
    expect(screen.getByRole("button", { name: /save this wall/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /finish this wall/i })).toBeInTheDocument();
    expect(screen.getByText(/archive library/i)).toBeInTheDocument();
    expect(screen.getByText(/message search/i)).toBeInTheDocument();
    expect(screen.getByText(/reports queue/i)).toBeInTheDocument();
    expect(screen.getByText(/visitor notes/i)).toBeInTheDocument();
    expect(screen.getByText(/moderation audit log/i)).toBeInTheDocument();
    expect(screen.getByText(/payment lookup/i)).toBeInTheDocument();
    expect(screen.getByText(/system health/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/eyJ|SERVICE_ROLE|sk_live/);
    expect(screen.queryByText(/preview only/i)).not.toBeInTheDocument();
  });

  it("saves title and clock through the admin event route", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>((input) => {
      const url = String(input);
      const body = url.includes("/api/admin/stats") ? overview : { event: overview.config };
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminDashboard initial={overview} email="ops@example.com" />);
    await user.clear(screen.getByLabelText(/^title$/i));
    await user.type(screen.getByLabelText(/^title$/i), "THE WALL №002");
    await user.click(screen.getByRole("button", { name: /save this wall/i }));
    expect(fetchMock).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/admin/event");
    expect(String(fetchMock.mock.calls[0]?.[1]?.body ?? "")).toMatch(/THE WALL №002/);
    vi.unstubAllGlobals();
  });

  it("requires confirmation before a removal can be submitted", async () => {
    const user = userEvent.setup();
    render(<AdminDashboard initial={overview} email="ops@example.com" />);
    await user.click(screen.getByRole("button", { name: /remove message/i }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^confirm$/i })).toBeDisabled();
  });
});
