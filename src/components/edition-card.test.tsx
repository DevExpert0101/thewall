import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditionCard } from "@/components/edition-card";
import type { EditionSummary } from "@/lib/types";

const edition: EditionSummary = {
  id: "local",
  editionNumber: 1,
  slug: "the-wall",
  title: "WALL OF HOPE",
  startsAt: "2026-08-08T00:00:00.000Z",
  endsAt: "2026-08-09T00:00:00.000Z",
  finalizedAt: "2026-08-09T00:00:05.000Z",
  totalMessages: 428193,
  totalReactions: 19284921,
  archiveHash: null,
  merkleRoot: null,
  archiveUri: null,
  proofTx: null,
  monumentNumber: 1,
  winning: {
    publicNumber: 4291,
    text: "The future needs people willing to believe it deserves one.",
    isRemoved: false,
    reactionCount: 1200,
    finalRank: 1,
    publishedAt: "2026-08-08T12:00:00.000Z",
  },
};

describe("edition catalog plaque", () => {
  it("lists the sealed Wall with its Victor and Monument number", () => {
    render(<EditionCard edition={edition} />);
    expect(screen.getByText("THE WALL №001")).toBeInTheDocument();
    expect(screen.getByText("WALL OF HOPE")).toBeInTheDocument();
    expect(screen.getByText(/august 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/428,193 inscriptions/i)).toBeInTheDocument();
    expect(screen.getByText(/19,284,921 🔥/)).toBeInTheDocument();
    expect(screen.getByText(/the future needs people/i)).toBeInTheDocument();
    expect(screen.getAllByText("M-0001").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /the wall №001/i })).toHaveAttribute("href", "/archive/001");
  });
});
