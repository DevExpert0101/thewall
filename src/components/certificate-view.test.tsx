import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CertificateView } from "@/components/certificate-view";
import { ARCHIVAL_REMOVAL_TEXT } from "@/lib/constants";

const data = {
  publicNumber: 4291,
  text: "I hope we were trying.",
  reactionCount: 12,
  finalRank: 4,
  publishedAt: "2026-08-13T10:00:00.000Z",
  eventTitle: "THE WALL",
  eventDate: "13 August 2026",
  tagline: "ONE DAY. ONE DOLLAR. ONE SENTENCE FOREVER.",
};

describe("certificate view", () => {
  it("offers screenshot, social, print, and PDF controls without exposing a receipt", () => {
    render(<CertificateView token={"a".repeat(64)} data={data} />);
    expect(screen.getByText(/message #004291/i)).toBeInTheDocument();
    expect(screen.getByText(/final rank: #4/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /download image/i })).toHaveAttribute(
      "href",
      expect.stringContaining("ratio=print"),
    );
    expect(screen.getByRole("link", { name: /download image/i })).toHaveAttribute(
      "download",
      "the-wall-certificate.png",
    );
    expect(screen.getByRole("link", { name: /1200×630/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /square/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /portrait/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /print \/ pdf/i })).toBeInTheDocument();
    expect(screen.getByText(/never your wall key or this private link/i)).toBeInTheDocument();
    expect(screen.queryByText(/receipt|invoice|wallet/i)).not.toBeInTheDocument();
  });

  it("shows archival removal text and keeps the number", () => {
    render(
      <CertificateView
        token={"a".repeat(64)}
        data={{ ...data, text: ARCHIVAL_REMOVAL_TEXT }}
      />,
    );
    expect(screen.getByText(/message #004291/i)).toBeInTheDocument();
    expect(screen.getByText(ARCHIVAL_REMOVAL_TEXT)).toBeInTheDocument();
  });
});
