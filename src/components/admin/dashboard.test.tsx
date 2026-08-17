import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminDashboard } from "@/components/admin/dashboard";
import { emptyAdminOps, type AdminOverview } from "@/lib/admin/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const config = {
  title: "THE WALL",
  slug: "the-wall",
  phase: "live" as const,
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
  themeSlug: null,
  themeQuestion: null,
  themeDescription: null,
  monumentNumber: null,
  archiveHash: null,
  merkleRoot: null,
  archiveUri: null,
  proofTx: null,
  windowMinutes: 1440,
  remainingMinutes: 720,
  publishEnabled: true,
  reactEnabled: true,
  strictBot: false,
};

const overview: AdminOverview = {
  config,
  totals: { messages: 2, reactions: 1, usdc: 2 },
  simulation: false,
  editions: [],
  feedback: [],
  claimAttempts: [],
  reactionSignals: [],
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
  reviewRanks: [],
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
  ops: emptyAdminOps(config),
  opsAudit: [],
};

describe("admin dashboard", () => {
  it("lets a steward configure this Wall without exposing secret material", () => {
    const { container } = render(<AdminDashboard initial={overview} email="ops@example.com" />);
    expect(screen.getByText(/current edition/i)).toBeInTheDocument();
    expect(screen.getByText(/^launch$/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /waiting room/i })).toHaveAttribute("href", "/open");
    expect(screen.getByRole("link", { name: /^invite/i })).toHaveAttribute("href", "/invite");
    expect(screen.getByRole("link", { name: /stream mode/i })).toHaveAttribute("href", "/watch/stream");
    expect(screen.getByRole("heading", { name: /this wall/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^title$/i)).toHaveValue("THE WALL");
    expect(screen.getByRole("button", { name: /save this wall/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close for review/i })).toBeInTheDocument();
    expect(screen.getByText(/review rankings/i)).toBeInTheDocument();
    expect(screen.getByText(/archive library/i)).toBeInTheDocument();
    expect(screen.getByText(/message search/i)).toBeInTheDocument();
    expect(screen.getByText(/reports queue/i)).toBeInTheDocument();
    expect(screen.getByText(/visitor notes/i)).toBeInTheDocument();
    expect(screen.getByText(/moderation audit log/i)).toBeInTheDocument();
    expect(screen.getByText(/payment lookup/i)).toBeInTheDocument();
    expect(screen.getByText(/reaction integrity/i)).toBeInTheDocument();
    expect(screen.getByText(/no suspicious/i)).toBeInTheDocument();
    expect(screen.getByText(/system health/i)).toBeInTheDocument();
    expect(screen.getByText(/launch day/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^event$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^traffic$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^emergency$/i })).toBeInTheDocument();
    expect(screen.getByText(/do not change the event deadline/i)).toBeInTheDocument();
    expect(screen.getByText(/unique viewers are not counted/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/eyJ|SERVICE_ROLE|sk_live/);
    expect(screen.queryByText(/preview only/i)).not.toBeInTheDocument();
  });

  it("shows suspicious 🔥 patterns without raw addresses", () => {
    const { container } = render(
      <AdminDashboard
        initial={{
          ...overview,
          reactionSignals: [
            {
              kind: "ip_burst",
              subject: "addr:9bf2a812c1d0",
              count: 21,
              createdAt: "2026-08-16T12:00:00.000Z",
              note: "21 🔥 from one address in 60s.",
            },
          ],
        }}
        email="ops@example.com"
      />,
    );
    expect(screen.getByText(/reaction integrity/i)).toBeInTheDocument();
    expect(screen.getByText(/visitors are not silently dropped/i)).toBeInTheDocument();
    expect(screen.getByText(/addr:9bf2a812c1d0/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/192\.168\.|10\.\d+\.|wall[_-]?key/i);
    expect(screen.queryByText(/no suspicious/i)).not.toBeInTheDocument();
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

  it("asks stewards to review rankings before disclosing a closed wall", () => {
    render(
      <AdminDashboard
        initial={{
          ...overview,
          config: { ...overview.config, phase: "finalizing", remainingMinutes: 0 },
          reviewRanks: [
            {
              id: "m1",
              publicNumber: 4,
              text: "I hope we still have fifty years.",
              reactionCount: 12,
              publishedAt: "2026-08-13T10:00:00.000Z",
              removedAt: null,
              moderationStatus: "approved",
              removalReasonCode: null,
            },
          ],
        }}
        email="ops@example.com"
      />,
    );
    expect(screen.getByText(/under review/i)).toBeInTheDocument();
    expect(screen.getAllByText(/remove illegal or immoral sentences/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/rank #1/i)).toBeInTheDocument();
    expect(screen.getByText(/fifty years/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /finish this wall/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /close for review/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start this wall/i })).not.toBeInTheDocument();
  });

  it("requires confirmation before a removal can be submitted", async () => {
    const user = userEvent.setup();
    render(<AdminDashboard initial={overview} email="ops@example.com" />);
    await user.click(screen.getByRole("button", { name: /remove message/i }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^confirm$/i })).toBeDisabled();
  });
});
