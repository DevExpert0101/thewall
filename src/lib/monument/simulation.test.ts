import { afterEach, describe, expect, it } from "vitest";
import {
  closeSimulatedWall,
  currentSimulatedEvent,
  getSimulatedMonumentEntry,
  listSimulatedEditions,
  listSimulatedMonumentEntries,
  reopenSimulatedWall,
  resetSimulationState,
} from "@/lib/data/simulation";
import { monumentCanvasFromEnv, plotForPosition } from "@/lib/monument/canvas";
import { formatMonumentNumber } from "@/lib/monument/format";

afterEach(() => {
  resetSimulationState();
});

describe("simulated Monument", () => {
  it("does not exist while the Wall is still live", () => {
    expect(currentSimulatedEvent().phase).toBe("live");
    expect(listSimulatedMonumentEntries()).toEqual([]);
    expect(listSimulatedEditions()).toEqual([]);
  });

  it("creates one sequential entry when a Wall is sealed", () => {
    closeSimulatedWall(new Date("2026-08-13T18:00:00Z"));
    const entries = listSimulatedMonumentEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.monumentNumber).toBe(1);
    expect(formatMonumentNumber(entries[0]!.monumentNumber)).toBe("M-0001");
    expect(entries[0]?.originalPublicNumber).toBe(4);
    expect(entries[0]?.editionNumber).toBe(1);
    expect(listSimulatedEditions()[0]?.monumentNumber).toBe(1);
    expect(getSimulatedMonumentEntry(1)?.eventId).toBe(entries[0]?.eventId);
    const plot = plotForPosition(1, monumentCanvasFromEnv());
    expect(entries[0]?.position).toBe(1);
    expect(entries[0]?.x).toBe(plot.x);
    expect(entries[0]?.y).toBe(plot.y);
  });

  it("is idempotent for the same sealed Wall", () => {
    closeSimulatedWall(new Date("2026-08-13T18:00:00Z"));
    const first = listSimulatedMonumentEntries();
    closeSimulatedWall(new Date("2026-08-13T18:00:00Z"));
    expect(listSimulatedMonumentEntries()).toHaveLength(1);
    expect(listSimulatedMonumentEntries()[0]?.monumentNumber).toBe(first[0]?.monumentNumber);
    expect(listSimulatedMonumentEntries()[0]?.x).toBe(first[0]?.x);
    expect(listSimulatedMonumentEntries()[0]?.y).toBe(first[0]?.y);
    expect(listSimulatedEditions()).toHaveLength(1);
  });

  it("assigns the next Monument number to the next sealed Wall", () => {
    closeSimulatedWall(new Date("2026-08-13T18:00:00Z"));
    reopenSimulatedWall();
    closeSimulatedWall(new Date("2026-08-14T18:00:00Z"));
    const entries = listSimulatedMonumentEntries();
    expect(entries.map((entry) => entry.monumentNumber)).toEqual([1, 2]);
    expect(entries[0]?.x === entries[1]?.x && entries[0]?.y === entries[1]?.y).toBe(false);
    expect(entries[0]?.width).toBe(entries[1]?.width);
    expect(listSimulatedEditions().map((edition) => edition.monumentNumber)).toEqual([1, 2]);
  });
});
