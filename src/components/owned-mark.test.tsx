import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { OwnedMark } from "@/components/owned-mark";
import { rememberOwnedMark } from "@/lib/ownership/store";

const KEY = "7K9P-X4MF-82QH-K3R2";

describe("owned mark", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("opens the public certificate without putting the Wall Key in a URL", async () => {
    rememberOwnedMark({
      message: 4291,
      claimKey: KEY,
      text: "I hope we were trying.",
    });
    render(<OwnedMark publicNumber={4291} reactionCount={12} finalRank={4} />);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /^certificate/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /^certificate/i })).toHaveAttribute(
      "href",
      "/message/4291/certificate",
    );
    expect(screen.getByRole("link", { name: /claim with wall key/i })).toHaveAttribute(
      "href",
      "/claim/4291",
    );
    expect(screen.getByText(KEY)).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(`/certificate/${KEY}`);
    expect(document.body.innerHTML).not.toContain(`/certificate/${encodeURIComponent(KEY)}`);
  });
});
