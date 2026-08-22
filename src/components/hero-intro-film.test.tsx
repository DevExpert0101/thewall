import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeroIntroFilm } from "@/components/hero-intro-film";

describe("hero intro film", () => {
  it("plays the inscription film once, then yields the stone", () => {
    const onDone = vi.fn();
    const { container } = render(<HeroIntroFilm onDone={onDone} />);
    const video = container.querySelector("video");
    expect(video?.getAttribute("poster")).toBe("/hero-wall.png");
    expect(container.querySelector("source")?.getAttribute("src")).toBe("/hero-wall.mp4");
    expect(video?.hasAttribute("loop")).toBe(false);
    video?.dispatchEvent(new Event("ended"));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
