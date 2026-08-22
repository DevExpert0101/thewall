import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Countdown } from "@/components/countdown";

describe("final-minute countdown", () => {
  it("holds each of the last ten seconds as a single number", () => {
    render(
      <Countdown
        targetIso="2026-08-16T20:00:08.500Z"
        serverNow="2026-08-16T20:00:00.000Z"
        nowMs={new Date("2026-08-16T20:00:00.000Z").getTime()}
        label="Until The Wall closes"
        phase="live"
      />,
    );
    expect(document.querySelector("[data-presentation='final-seconds']")).toBeTruthy();
    expect(document.querySelector(".countdown-final-seconds")?.textContent).toBe("9");
    expect(screen.getByText("Seconds")).toBeInTheDocument();
  });

  it("does not keep ticking after zero", () => {
    render(
      <Countdown
        targetIso="2026-08-16T20:00:00.000Z"
        serverNow="2026-08-16T20:00:00.000Z"
        nowMs={new Date("2026-08-16T20:00:00.000Z").getTime()}
        label="Until The Wall closes"
        phase="finalizing"
      />,
    );
    expect(document.querySelector("[data-presentation='closed']")).toBeTruthy();
    expect(document.querySelector(".countdown-final-seconds")).toBeNull();
  });
});
