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

describe("message HTML injection", () => {
  it("renders attacker markup as text, not as a script node", () => {
    const { container } = render(<MessageCard message={injected} phase="live" />);
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(container.innerHTML).not.toContain("<script>alert(1)</script>");
  });
});
