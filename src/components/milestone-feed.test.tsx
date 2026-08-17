import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MilestoneFeed } from "@/components/milestone-feed";
import { reachedMilestones } from "@/lib/milestones/engine";

describe("MilestoneFeed", () => {
  it("lists only marks the totals have reached", () => {
    render(
      <MilestoneFeed
        marks={reachedMilestones({ messages: 18, reactions: 401 })}
        phase="live"
      />,
    );
    expect(screen.getByText("MESSAGE #000001")).toBeInTheDocument();
    expect(screen.getByText("MESSAGE #000010")).toBeInTheDocument();
    expect(screen.queryByText("MESSAGE #000100")).not.toBeInTheDocument();
    expect(screen.queryByText(/10,000 🔥/)).not.toBeInTheDocument();
  });

  it("stays quiet before the Wall opens", () => {
    const { container } = render(
      <MilestoneFeed
        marks={reachedMilestones({ messages: 18, reactions: 401 })}
        phase="upcoming"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
