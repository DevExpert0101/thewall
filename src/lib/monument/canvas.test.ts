import { describe, expect, it } from "vitest";
import {
  DEFAULT_CELL_HEIGHT,
  DEFAULT_CELL_WIDTH,
  monumentCanvasFrom,
  plotForPosition,
} from "@/lib/monument/canvas";

describe("Monument canvas geometry", () => {
  const canvas = monumentCanvasFrom();

  it("gives every sentence the same plot size", () => {
    const first = plotForPosition(1, canvas);
    const later = plotForPosition(Math.min(8, canvas.capacity), canvas);
    expect(first.width).toBe(DEFAULT_CELL_WIDTH);
    expect(first.height).toBe(DEFAULT_CELL_HEIGHT);
    expect(later.width).toBe(first.width);
    expect(later.height).toBe(first.height);
  });

  it("places sentences at different on-canvas locations without moving earlier plots", () => {
    const one = plotForPosition(1, canvas);
    const two = plotForPosition(2, canvas);
    expect(one.x).toBeGreaterThanOrEqual(0);
    expect(one.y).toBeGreaterThanOrEqual(0);
    expect(one.x + one.width).toBeLessThanOrEqual(canvas.width);
    expect(one.y + one.height).toBeLessThanOrEqual(canvas.height);
    expect(two.x + two.width).toBeLessThanOrEqual(canvas.width);
    expect(two.y + two.height).toBeLessThanOrEqual(canvas.height);
    expect(one.x === two.x && one.y === two.y).toBe(false);
    expect(plotForPosition(1, canvas)).toEqual(one);
  });

  it("stays on one screen and does not invent a public 1000-slot product limit", () => {
    expect(canvas.width).toBeLessThanOrEqual(1920);
    expect(canvas.height).toBeLessThanOrEqual(1200);
    expect(monumentCanvasFrom({ capacity: null }).capacity).toBe(canvas.columns * canvas.rows);
    expect(monumentCanvasFrom({ width: 800, height: 400, cellWidth: 200, cellHeight: 100 }).capacity).toBe(16);
  });
});
