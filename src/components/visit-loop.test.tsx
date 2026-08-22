import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VisitLoop } from "@/components/visit-loop";

describe("VisitLoop", () => {
  it("invites a live visitor to react by browsing and writing", () => {
    render(
      <VisitLoop
        phase="live"
        endsAt="2026-08-13T18:00:00.000Z"
        serverNow="2026-08-13T12:00:00.000Z"
        editionNumber={1}
      />,
    );
    expect(screen.getByText(/the wall closes in 6 hours/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse the wall/i })).toHaveAttribute("href", "/wall");
    expect(screen.getByRole("link", { name: /leave your mark — \$1/i })).toHaveAttribute("href", "/wall");
    expect(screen.getByRole("link", { name: /watch the wall/i })).toHaveAttribute("href", "/watch");
    expect(screen.queryByText(/people are viewing|don't miss|last chance to be famous/i)).not.toBeInTheDocument();
  });

  it("does not offer a write CTA after close", () => {
    render(
      <VisitLoop
        phase="finalizing"
        endsAt="2026-08-13T18:00:00.000Z"
        serverNow="2026-08-13T18:00:01.000Z"
        editionNumber={1}
      />,
    );
    expect(screen.queryByRole("link", { name: /leave your mark/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse the wall/i })).toBeInTheDocument();
  });

  it("sends archived visitors into the sealed edition", () => {
    render(
      <VisitLoop
        phase="archived"
        endsAt="2026-08-13T18:00:00.000Z"
        serverNow="2026-08-14T12:00:00.000Z"
        editionNumber={1}
      />,
    );
    expect(screen.getByRole("link", { name: /browse this wall/i })).toHaveAttribute(
      "href",
      "/archive/001",
    );
    expect(screen.queryByRole("link", { name: /leave your mark/i })).not.toBeInTheDocument();
  });
});
