import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WallKeyPanel } from "@/components/wall-key-panel";

const KEY = "7K9P-X4MF-82QH-K3R2";

describe("wall key panel", () => {
  it("states the private receipt and never links the key", () => {
    render(
      <WallKeyPanel
        wallKey={KEY}
        publicNumber={4291}
        text="I hope we were trying."
      />,
    );
    expect(screen.getByText("YOUR WALL KEY")).toBeInTheDocument();
    expect(screen.getByText(KEY)).toBeInTheDocument();
    expect(
      screen.getByText("This private key proves that Message #004291 is yours."),
    ).toBeInTheDocument();
    expect(screen.getByText("Keep it somewhere safe.")).toBeInTheDocument();
    expect(screen.getByText("We cannot recover it.")).toBeInTheDocument();
    expect(screen.getByText("OWNERSHIP RECEIPT")).toBeInTheDocument();
    expect(screen.getByText("Contains Wall Key. Never share.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy wall key/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save ownership receipt/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save as image/i })).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(`/certificate/${KEY}`);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
