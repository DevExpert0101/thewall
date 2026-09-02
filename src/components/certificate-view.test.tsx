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
  tagline: "ONE DAY. ONE DOLLAR. ONE SENTENCE.",
};

const TOKEN = "a".repeat(64);

describe("certificate view", () => {
  it("offers screenshot, social, print, and PDF controls without exposing a receipt", () => {
    render(<CertificateView data={data} />);
    expect(screen.getByText("PUBLIC CERTIFICATE")).toBeInTheDocument();
    expect(screen.getByText(/this is the certificate/i)).toBeInTheDocument();
    expect(screen.getAllByText(/message #004291/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/place on the wall: #4/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /download image/i })).toHaveAttribute(
      "href",
      "/message/4291/certificate/image?ratio=print",
    );
    expect(screen.getByRole("link", { name: /download image/i })).toHaveAttribute(
      "download",
      "the-wall-certificate.png",
    );
    expect(screen.getByRole("link", { name: /1200×630/i })).toHaveAttribute(
      "href",
      "/message/4291/certificate/image?ratio=1200x630",
    );
    expect(screen.getByRole("link", { name: /square/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /portrait/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /print \/ pdf/i })).toBeInTheDocument();
    expect(screen.getByText(/never share your wall key/i)).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /qr code for the public certificate of message 4291/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("http://localhost:3000/message/4291/certificate")).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(TOKEN);
    expect(document.body.innerHTML).not.toContain('href="/certificate/');
    expect(screen.queryByText(/receipt|invoice|wallet/i)).not.toBeInTheDocument();
  });

  it("shows archival removal text and keeps the number", () => {
    render(
      <CertificateView
        data={{ ...data, text: ARCHIVAL_REMOVAL_TEXT }}
      />,
    );
    expect(screen.getAllByText(/message #004291/i).length).toBeGreaterThan(0);
    expect(screen.getByText(ARCHIVAL_REMOVAL_TEXT)).toBeInTheDocument();
  });
});
