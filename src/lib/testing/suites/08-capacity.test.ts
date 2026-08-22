import { describe, expect, it } from "vitest";
import { monumentCanvasFrom, plotForPosition } from "@/lib/monument/canvas";
import { parseMonumentCapacity } from "@/lib/monument/policy";

describe("suite 8 — canvas capacity", () => {
  it("does not invent a public capacity when unset", () => {
    expect(parseMonumentCapacity(undefined)).toBeNull();
  });

  it("lets the last free plot succeed and refuses the next without moving #1", () => {
    const canvas = monumentCanvasFrom({
      width: 400,
      height: 200,
      cellWidth: 100,
      cellHeight: 100,
      capacity: 4,
    });
    expect(canvas.capacity).toBe(4);
    const first = plotForPosition(1, canvas);
    const last = plotForPosition(4, canvas);
    expect(last.position).toBe(4);
    expect(last.x === first.x && last.y === first.y).toBe(false);
    expect(() => plotForPosition(5, canvas)).toThrow(/full/i);
    expect(plotForPosition(1, canvas)).toEqual(first);
  });

  it("never silently expands past the configured cap", () => {
    const canvas = monumentCanvasFrom({
      width: 1000,
      height: 1000,
      cellWidth: 100,
      cellHeight: 100,
      capacity: 3,
    });
    expect(canvas.capacity).toBe(3);
    expect(() => plotForPosition(4, canvas)).toThrow(/full/i);
  });
});
