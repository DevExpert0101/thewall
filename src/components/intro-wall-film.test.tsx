import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IntroWallFilm } from "@/components/intro-wall-film";

describe("intro wall film", () => {
  it("plays the inscription film without looping", () => {
    const { container } = render(<IntroWallFilm />);
    const video = container.querySelector("video");
    expect(video).toBeTruthy();
    expect(video?.getAttribute("poster")).toBe("/hero-wall.png");
    expect(container.querySelector("source")?.getAttribute("src")).toBe("/hero-wall.mp4");
    expect(video?.hasAttribute("loop")).toBe(false);
  });
});
