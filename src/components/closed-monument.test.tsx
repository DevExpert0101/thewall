import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClosedMonument } from "@/components/closed-monument";

describe("closed monument", () => {
  it("states the close and the census without opening the Archive during review", () => {
    render(<ClosedMonument editionNumber={1} totalMessages={428193} />);
    expect(screen.getByText("THE WALL №001 HAS CLOSED.")).toBeInTheDocument();
    expect(screen.getByText("428,193 PEOPLE SPOKE.")).toBeInTheDocument();
    expect(screen.getByText("NO ONE CAN ADD ANOTHER WORD.")).toBeInTheDocument();
    expect(screen.getByText(/final ranks are not public yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /enter the archive/i })).not.toBeInTheDocument();
  });

  it("opens the Archive only after the day is sealed", () => {
    render(<ClosedMonument editionNumber={1} totalMessages={428193} sealed />);
    expect(screen.getByRole("link", { name: /enter the archive/i })).toHaveAttribute("href", "/archive");
    expect(screen.queryByText(/final ranks are not public yet/i)).not.toBeInTheDocument();
  });
});
