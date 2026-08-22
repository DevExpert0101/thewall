import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArchiveVerifyView } from "@/components/archive-verify";

describe("archive verification plaque", () => {
  it("shows a sealed edition without requiring a chain", () => {
    render(
      <ArchiveVerifyView
        editionNumber={1}
        title="THE WALL"
        totalMessages={428193}
        finalizedAt="2026-08-09T00:00:00.000Z"
        archiveHash="9bf2aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa812"
        merkleRoot="82aeaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa91cc"
        matches
      />,
    );
    expect(screen.getByText(/verified archive/i)).toBeInTheDocument();
    expect(screen.getByText("THE WALL №001")).toBeInTheDocument();
    expect(screen.getByText("428,193")).toBeInTheDocument();
    expect(screen.getByText("August 9, 2026")).toBeInTheDocument();
    expect(screen.getByText("9BF2...A812")).toBeInTheDocument();
    expect(screen.getByText("82AE...91CC")).toBeInTheDocument();
    expect(screen.getByText(/you do not need a wallet, a chain/i)).toBeInTheDocument();
    expect(screen.getByText(/not, by itself, permanent storage/i)).toBeInTheDocument();
    expect(screen.queryByText(/blockchain/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /download the archive/i })).toHaveAttribute(
      "href",
      "/archive/001/download",
    );
  });

  it("does not mark an incomplete seal as verified", () => {
    render(
      <ArchiveVerifyView
        editionNumber={1}
        title="THE WALL"
        totalMessages={12}
        finalizedAt="2026-08-09T00:00:00.000Z"
        archiveHash={null}
        merkleRoot={null}
        matches={false}
      />,
    );
    expect(screen.getByText(/archive not verified/i)).toBeInTheDocument();
    expect(screen.getByText(/seal has not been recorded/i)).toBeInTheDocument();
    expect(screen.queryByText(/verified archive/i)).not.toBeInTheDocument();
  });
});
