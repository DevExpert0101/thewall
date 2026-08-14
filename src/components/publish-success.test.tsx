import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublishSuccess } from "@/components/publish-success";

const KEY = "7K9P-X4MF-82QH-K3R2";

describe("publish success", () => {
  it("celebrates the sentence and shows the Wall Key", () => {
    render(
      <PublishSuccess
        publicNumber={4291}
        text="I hope we were trying."
        endsAt="2026-08-13T18:00:00.000Z"
        serverNow="2026-08-13T00:17:51.000Z"
        ownershipToken={KEY}
      />,
    );
    expect(screen.getByText(/you are on the wall/i)).toBeInTheDocument();
    expect(screen.getByText(/message #004291/i)).toBeInTheDocument();
    expect(screen.getByText(/your sentence is now part of the wall/i)).toBeInTheDocument();
    expect(screen.getByText(/“I hope we were trying.”/)).toBeInTheDocument();
    expect(screen.getByText("🔥 0")).toBeInTheDocument();
    expect(screen.getByText(/17:42:09 remaining/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share your message/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open #004291/i })).toHaveAttribute("href", "/message/4291");
    expect(screen.getByText("/message/4291")).toBeInTheDocument();
    expect(screen.getByText(KEY)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy wall key/i })).toBeInTheDocument();
    expect(screen.queryByText(/invoice/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/connect wallet/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /finish this wall and open the archive/i })).not.toBeInTheDocument();
  });

  it("offers a local finish-and-archive path in simulation", () => {
    render(
      <PublishSuccess
        publicNumber={19}
        text="I left this in the local chamber."
        endsAt="2026-08-13T18:00:00.000Z"
        serverNow="2026-08-13T00:17:51.000Z"
        ownershipToken={KEY}
        simulation
      />,
    );
    expect(screen.getByRole("button", { name: /finish this wall and open the archive/i })).toBeInTheDocument();
  });
});
