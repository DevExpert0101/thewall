import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WinnerAnnouncement } from "@/components/winner-announcement";

describe("public winner announcement", () => {
  it("shows only edition, number, sentence, and final fire", () => {
    render(
      <WinnerAnnouncement
        winner={{
          editionNumber: 1,
          publicNumber: 4291,
          text: "Call your mother.",
          reactionCount: 19284,
          isRemoved: false,
        }}
      />,
    );
    expect(screen.getByText(/the victor/i)).toBeInTheDocument();
    expect(screen.getByText("THE WALL №001")).toBeInTheDocument();
    expect(screen.getByText("MESSAGE #004291")).toBeInTheDocument();
    expect(screen.getAllByText(/call your mother/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/19,284 🔥/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/wallet|wall key|0x|owner|email|payout/i)).not.toBeInTheDocument();
  });
});
