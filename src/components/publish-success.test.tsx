import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublishSuccess } from "@/components/publish-success";

const KEY = "7K9P-X4MF-82QH-K3R2";

describe("publish success", () => {
  it("celebrates the sentence as a numbered object on the Wall", () => {
    render(
      <PublishSuccess
        publicNumber={4291}
        text="I hope we were trying."
        endsAt="2026-08-13T18:00:00.000Z"
        serverNow="2026-08-13T00:17:51.000Z"
        ownershipToken={KEY}
        editionNumber={1}
      />,
    );
    expect(screen.getByText(/you are on the wall/i)).toBeInTheDocument();
    expect(screen.getByText("MESSAGE #004291")).toBeInTheDocument();
    expect(screen.getByText(/your sentence now has a place in the wall №001/i)).toBeInTheDocument();
    expect(screen.getAllByText(/“I hope we were trying.”/).length).toBeGreaterThan(0);
    expect(screen.getByText(/17:42:09 remaining/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see this sentence/i })).toHaveAttribute("href", "/message/4291");
    expect(screen.getByRole("button", { name: /share this sentence/i })).toBeInTheDocument();
    expect(screen.queryByText(/get your message seen/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save ownership receipt/i })).toBeInTheDocument();
    expect(screen.getByText(KEY)).toBeInTheDocument();
    expect(screen.getByText("YOUR WALL KEY")).toBeInTheDocument();
    expect(screen.getByText(/this private key proves that message #004291 is yours/i)).toBeInTheDocument();
    expect(screen.getByText("PUBLIC CERTIFICATE")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open certificate/i })).toHaveAttribute(
      "href",
      "/message/4291/certificate",
    );
    expect(document.body.innerHTML).not.toContain(`/certificate/${KEY}`);
    expect(screen.queryByText(/order complete/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/purchase confirmation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/transaction receipt/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/invoice/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/connect wallet/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /finish this wall and open the archive/i })).not.toBeInTheDocument();
  });

  it("does not finish the Wall from the public success screen", () => {
    render(
      <PublishSuccess
        publicNumber={19}
        text="I left this in the local chamber."
        endsAt="2026-08-13T18:00:00.000Z"
        serverNow="2026-08-13T00:17:51.000Z"
        ownershipToken={KEY}
      />,
    );
    expect(screen.queryByRole("button", { name: /finish this wall/i })).not.toBeInTheDocument();
  });
});
