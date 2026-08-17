import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VictorRace } from "@/components/victor-race";

const leaders = [
  {
    publicNumber: 4291,
    text: "The future needs people willing to believe it deserves one.",
    isRemoved: false,
    reactionCount: 491283,
    publishedAt: "2026-08-08T12:00:00.000Z",
  },
  {
    publicNumber: 2821,
    text: "Second.",
    isRemoved: false,
    reactionCount: 486462,
    publishedAt: "2026-08-08T11:00:00.000Z",
  },
  {
    publicNumber: 18,
    text: "Third.",
    isRemoved: false,
    reactionCount: 400000,
    publishedAt: "2026-08-08T10:00:00.000Z",
  },
];

describe("live Victor race", () => {
  it("shows a provisional leader without declaring a winner", () => {
    render(<VictorRace leaders={leaders} live />);
    expect(screen.getAllByText(/currently entering/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/current leader/i)).toBeInTheDocument();
    expect(screen.getByText("#004291")).toBeInTheDocument();
    expect(screen.getByText(/#2 is 4,821 🔥 behind/i)).toBeInTheDocument();
    expect(screen.getByText(/if the wall closed now/i)).toBeInTheDocument();
    expect(screen.getByText(/provisional until sealing/i)).toBeInTheDocument();
    expect(screen.queryByText(/the victor/i)).not.toBeInTheDocument();
  });

  it("does not render after the Wall is no longer writable", () => {
    const { container } = render(<VictorRace leaders={leaders} live={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
