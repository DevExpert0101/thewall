import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MonumentEntryView } from "@/components/monument-entry-view";
import { ARCHIVAL_REMOVAL_TEXT } from "@/lib/constants";
import { sampleMonumentEntry } from "@/lib/monument/sample";

describe("Monument entry", () => {
  it("shows the Victor and links back to the Wall that created it", () => {
    render(<MonumentEntryView entry={sampleMonumentEntry()} />);
    expect(screen.getByText("M-0007")).toBeInTheDocument();
    expect(screen.getByText("WALL OF HOPE")).toBeInTheDocument();
    expect(screen.getByText(/the victor/i)).toBeInTheDocument();
    expect(screen.getByText(/the future needs people/i)).toBeInTheDocument();
    expect(screen.getByText(/10,281 🔥/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view the wall that created this victor/i })).toHaveAttribute(
      "href",
      "/archive/007",
    );
    expect(screen.getByRole("link", { name: /view original inscription/i })).toHaveAttribute(
      "href",
      "/archive/007/4291",
    );
    expect(screen.queryByText(/wall key|wallet|0x|owner/i)).not.toBeInTheDocument();
  });

  it("keeps a removed Victor's number and redacts the sentence", () => {
    render(
      <MonumentEntryView
        entry={sampleMonumentEntry({ isRemoved: true, text: ARCHIVAL_REMOVAL_TEXT })}
      />,
    );
    expect(screen.getByText("M-0007")).toBeInTheDocument();
    expect(screen.getByText(ARCHIVAL_REMOVAL_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(/the future needs people/i)).not.toBeInTheDocument();
  });
});
