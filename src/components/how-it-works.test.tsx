import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HowItWorks } from "@/components/how-it-works";
import { ARCHIVAL_REMOVAL_TEXT } from "@/lib/constants";

describe("How it works", () => {
  it("explains pay, mark, react, freeze, archive, and verify", () => {
    render(<HowItWorks />);
    expect(screen.getByText("How it works")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /seven steps/i })).toBeInTheDocument();
    expect(screen.getByText("PAY")).toBeInTheDocument();
    expect(screen.getByText("MARK")).toBeInTheDocument();
    expect(screen.getByText("REACT")).toBeInTheDocument();
    expect(screen.getByText("FREEZE")).toBeInTheDocument();
    expect(screen.getByText("ARCHIVE")).toBeInTheDocument();
    expect(screen.getByText("MONUMENT")).toBeInTheDocument();
    expect(screen.getByText("VERIFY")).toBeInTheDocument();
    expect(screen.getByText("One dollar. One sentence.")).toBeInTheDocument();
    expect(screen.getByText("Your sentence gets a number.")).toBeInTheDocument();
    expect(screen.getByText("Anyone can add fire while the day is open.")).toBeInTheDocument();
    expect(screen.getByText("When the clock hits zero, writing stops.")).toBeInTheDocument();
    expect(screen.getByText("The day becomes The Wall №001.")).toBeInTheDocument();
    expect(screen.getByText("You can check the sealed file.")).toBeInTheDocument();
  });

  it("answers the usual doubts without overclaiming", () => {
    const { container } = render(<HowItWorks />);
    const text = container.textContent ?? "";

    expect(screen.getByText("Why does this cost $1?")).toBeInTheDocument();
    expect(screen.getByText("Will my payment disappear?")).toBeInTheDocument();
    expect(screen.getByText("Is the reaction count fake?")).toBeInTheDocument();
    expect(screen.getByText("Can administrators change the winner?")).toBeInTheDocument();
    expect(screen.getByText("Is the Wall actually permanent?")).toBeInTheDocument();
    expect(screen.getByText("Is my message really anonymous?")).toBeInTheDocument();
    expect(screen.getByText("What does the Wall Key do?")).toBeInTheDocument();
    expect(screen.getByText("Can someone steal my message?")).toBeInTheDocument();
    expect(screen.getByText("What happens if content is removed?")).toBeInTheDocument();
    expect(screen.getByText("What happens when the timer reaches zero?")).toBeInTheDocument();

    expect(text).toContain(ARCHIVAL_REMOVAL_TEXT);
    expect(text).toMatch(/not the same as untraceable/i);
    expect(text).toMatch(/does not seal itself/i);
    expect(text).toMatch(/under review/i);
    expect(text).toMatch(/does not reverse an on-chain transfer/i);
    expect(text).toMatch(/do not pay again/i);
    expect(text).toMatch(/working copy/i);
    expect(text).toMatch(/can change who stands first/i);
    expect(text).not.toMatch(/completely untraceable/i);
    expect(text).not.toMatch(/completely anonymous/i);
    expect(text).not.toMatch(/Connect Wallet/i);
    expect(text).not.toMatch(/anonymous payout/i);
  });
});
