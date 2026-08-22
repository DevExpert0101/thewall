import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MilestoneToast } from "@/components/milestone-toast";
import { parseMilestoneQuery } from "@/lib/milestones/engine";

const event = {
  phase: "live" as const,
  endsAt: "2026-08-13T18:00:00.000Z",
  serverNow: "2026-08-13T12:00:00.000Z",
  editionNumber: 1,
};

describe("MilestoneToast", () => {
  it("celebrates a verified mark without trapping the visitor", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(
      <MilestoneToast
        milestone={parseMilestoneQuery({ mark: "10000" })!}
        event={event}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText("MESSAGE #010000")).toBeInTheDocument();
    expect(screen.getByText("10,000 PEOPLE HAVE SPOKEN.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share this mark/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /save card/i })).toHaveAttribute(
      "href",
      expect.stringContaining("mark=10000"),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
