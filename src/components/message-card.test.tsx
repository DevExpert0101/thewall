import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageCard } from "@/components/message-card";
import type { PublicMessage } from "@/lib/types";

const injected: PublicMessage = {
  id: "00000000-0000-4000-8000-000000000009",
  eventId: "local",
  publicNumber: 9,
  text: "<script>alert(1)</script>",
  isRemoved: false,
  reactionCount: 0,
  publishedAt: "2026-08-13T12:00:00.000Z",
  finalRank: null,
};

describe("message identity", () => {
  it("names the object as an edition and message number", () => {
    render(
      <MessageCard
        message={injected}
        phase="live"
        event={{
          phase: "live",
          endsAt: "2026-08-13T18:00:00.000Z",
          serverNow: "2026-08-13T12:00:00.000Z",
          editionNumber: 1,
        }}
      />,
    );
    expect(screen.getByText("THE WALL №001 / MESSAGE #000009")).toBeInTheDocument();
  });
});

describe("archived message card", () => {
  it("shows a sealed fire count and no react control", () => {
    render(
      <MessageCard
        message={{ ...injected, reactionCount: 42, finalRank: 1 }}
        phase="archived"
        rankLabel="Rank #1"
        event={{
          phase: "archived",
          endsAt: "2026-08-13T18:00:00.000Z",
          serverNow: "2026-08-13T19:00:00.000Z",
          editionNumber: 1,
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: /react with fire/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/42 reactions/i)).toBeInTheDocument();
    expect(screen.getByText(/rank #1/i)).toBeInTheDocument();
  });
});

describe("message HTML injection", () => {
  it("renders attacker markup as text, not as a script node", () => {
    const { container } = render(<MessageCard message={injected} phase="live" />);
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(container.innerHTML).not.toContain("<script>alert(1)</script>");
  });
});
