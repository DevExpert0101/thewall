import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WitnessPlaque } from "@/components/witness-plaque";
import type { PublicMessage } from "@/lib/types";

const message: PublicMessage = {
  id: "m-4",
  eventId: "local",
  publicNumber: 4,
  text: "If you are reading this in fifty years, I drove a night bus and I liked the quiet.",
  isRemoved: false,
  reactionCount: 67,
  publishedAt: "2026-08-16T16:00:00.000Z",
  finalRank: null,
};

describe("WitnessPlaque", () => {
  it("shows a real number and fire count, not a sample certificate", () => {
    render(
      <WitnessPlaque
        message={message}
        event={{ phase: "live", editionNumber: 1 }}
      />,
    );
    expect(screen.getByText("THE WALL №001 / MESSAGE #000004")).toBeInTheDocument();
    expect(screen.getByText(/fifty years/i)).toBeInTheDocument();
    expect(screen.getByText(/67 🔥 · on this wall now/i)).toBeInTheDocument();
    expect(screen.queryByText(/#004291/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sample composition/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/final rank/i)).not.toBeInTheDocument();
  });
});
