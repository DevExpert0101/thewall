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
  },
  totals: { messages: 2, reactions: 1, usdc: 2 },
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
  it("shows operational sections without an event editor or secret material", () => {
    const { container } = render(<AdminDashboard initial={overview} email="ops@example.com" />);
    expect(screen.getByText(/event overview/i)).toBeInTheDocument();
    expect(screen.getByText(/event configuration/i)).toBeInTheDocument();
    expect(screen.getByText(/message search/i)).toBeInTheDocument();
    expect(screen.getByText(/reports queue/i)).toBeInTheDocument();
    expect(screen.getByText(/moderation audit log/i)).toBeInTheDocument();
    expect(screen.getByText(/payment lookup/i)).toBeInTheDocument();
    expect(screen.getByText(/system health/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save event/i })).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/eyJ|SERVICE_ROLE|sk_live/);
    expect(screen.getByText(/preview only/i)).toBeInTheDocument();
  });

  it("requires confirmation before a removal can be submitted", async () => {
    const user = userEvent.setup();
    render(<AdminDashboard initial={overview} email="ops@example.com" />);
    await user.click(screen.getByRole("button", { name: /remove message/i }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^confirm$/i })).toBeDisabled();
  });
});
