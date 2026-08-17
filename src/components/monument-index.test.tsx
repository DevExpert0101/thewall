import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MonumentIndex } from "@/components/monument-index";
import { ARCHIVAL_REMOVAL_TEXT } from "@/lib/constants";
import { monumentCanvasFromEnv } from "@/lib/monument/canvas";
import { sampleMonumentEntry } from "@/lib/monument/sample";

const canvas = monumentCanvasFromEnv();

describe("The Monument canvas", () => {
  it("is blank until a Wall is sealed", () => {
    const { container } = render(
      <MonumentIndex catalog={{ entries: [], sealedCount: 0, capacity: null, canvas }} />,
    );
    expect(screen.getByRole("heading", { name: /the monument/i })).toBeInTheDocument();
    expect(container.querySelectorAll(".monument-sentence")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /reset view|zoom/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/available|future winner|placeholder/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/you cannot buy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/view record/i)).not.toBeInTheDocument();
  });

  it("writes only winning sentences onto the permanent surface", () => {
    const first = sampleMonumentEntry({
      monumentNumber: 1,
      position: 1,
      id: "m1",
      editionNumber: 1,
      originalPublicNumber: 12,
      text: "Maybe kindness was the entire point.",
      sentenceSnapshot: "Maybe kindness was the entire point.",
    });
    const second = sampleMonumentEntry({
      monumentNumber: 2,
      position: 2,
      id: "m2",
      editionNumber: 2,
      originalPublicNumber: 8,
      text: "Call your mother.",
      sentenceSnapshot: "Call your mother.",
    });
    const { container } = render(
      <MonumentIndex catalog={{ entries: [first, second], sealedCount: 2, capacity: null, canvas }} />,
    );
    expect(screen.getByText(/maybe kindness was the entire point/i)).toBeInTheDocument();
    expect(screen.getByText(/call your mother/i)).toBeInTheDocument();
    const sentences = container.querySelectorAll<HTMLElement>(".monument-sentence");
    expect(sentences[0]?.style.left).toBe(`${(first.x / canvas.width) * 100}%`);
    expect(sentences[0]?.style.top).toBe(`${(first.y / canvas.height) * 100}%`);
    expect(sentences[0]?.style.fontSize).toBe("15px");
    expect(sentences[1]?.style.left).toBe(`${(second.x / canvas.width) * 100}%`);
    expect(sentences[1]?.style.top).toBe(`${(second.y / canvas.height) * 100}%`);
    expect(sentences[1]?.style.fontSize).toBe("15px");
    expect(screen.getByRole("link", { name: /maybe kindness was the entire point/i })).toHaveAttribute(
      "href",
      "/archive/001/12",
    );
    expect(screen.getByRole("link", { name: /call your mother/i })).toHaveAttribute("href", "/archive/002/8");
    expect(screen.queryByRole("button", { name: /reset view|zoom/i })).not.toBeInTheDocument();
    expect(screen.queryByText("M-0001")).not.toBeInTheDocument();
    expect(screen.queryByText("WALL OF HOPE")).not.toBeInTheDocument();
    expect(screen.queryByText(/🔥/)).not.toBeInTheDocument();
    expect(screen.queryByText(/inscriptions competed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/view record/i)).not.toBeInTheDocument();
  });

  it("keeps a removed Victor's place as the archival sentence", () => {
    render(
      <MonumentIndex
        catalog={{
          entries: [sampleMonumentEntry({ isRemoved: true, text: ARCHIVAL_REMOVAL_TEXT, sentenceSnapshot: ARCHIVAL_REMOVAL_TEXT })],
          sealedCount: 1,
          capacity: null,
          canvas,
        }}
      />,
    );
    expect(screen.getByRole("link", { name: ARCHIVAL_REMOVAL_TEXT })).toHaveAttribute(
      "href",
      "/archive/007/4291",
    );
    expect(screen.queryByText(/the future needs people/i)).not.toBeInTheDocument();
  });
});
