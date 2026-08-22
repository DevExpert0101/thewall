import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LivingWall } from "@/components/living-wall";
import { boxesOverlap, layoutLiveWall, liveFontPx } from "@/lib/wall/surface";
import type { PublicMessage } from "@/lib/types";

function message(n: number, extra: Partial<PublicMessage> = {}): PublicMessage {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    eventId: "local",
    publicNumber: n,
    text: `Sentence ${n} on the wall.`,
    isRemoved: false,
    reactionCount: n,
    publishedAt: "2026-08-13T12:00:00.000Z",
    finalRank: null,
    ...extra,
  };
}

describe("living wall", () => {
  it("writes every sentence onto one surface and grows hotter type", () => {
    const quiet = message(1, { reactionCount: 1, text: "A quiet line." });
    const hot = message(4, { reactionCount: 80, text: "The loudest line." });
    const { container } = render(
      <LivingWall messages={[quiet, hot]} phase="live" />,
    );
    expect(screen.getByText("A quiet line.")).toBeInTheDocument();
    expect(screen.getByText("The loudest line.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /the loudest line/i })).toHaveAttribute("href", "/message/4");
    const articles = container.querySelectorAll<HTMLElement>(".living-sentence");
    const quietFont = Number.parseFloat(articles[0]?.style.fontSize ?? "0");
    const hotFont = Number.parseFloat(articles[1]?.style.fontSize ?? "0");
    expect(hotFont).toBeGreaterThan(quietFont);
    expect(hotFont).toBeCloseTo(liveFontPx(80, 80, 2));
    expect(container.querySelector(".living-wall")?.classList.contains("overflow-y-auto")).toBe(false);
    const layout = layoutLiveWall([quiet, hot]);
    expect(boxesOverlap(layout[0]!, layout[1]!)).toBe(false);
  });
});
