import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { monumentCanvasFromEnv, plotForPosition } from "@/lib/monument/canvas";
import {
  addReactions,
  monumentCatalog,
  openNextAutomatedWall,
  openShortLiveWall,
  payAndPublish,
  resetAutomatedWall,
  sealAutomatedWall,
} from "@/lib/testing/harness";

afterEach(() => {
  resetAutomatedWall();
});

describe("suite 7 — permanent sentence wall", () => {
  it("starts empty, then keeps Wall #1 coordinates when Wall #2 is sealed", () => {
    resetAutomatedWall();
    expect(monumentCatalog()).toEqual([]);
    openShortLiveWall();
    const first = payAndPublish("First permanent winner.");
    addReactions(first.messageId, 80);
    sealAutomatedWall();
    expect(monumentCatalog()).toHaveLength(1);
    expect(monumentCatalog()[0]?.text).toBe(first.text);
    const snapshot = structuredClone(monumentCatalog()[0]);
    openNextAutomatedWall("WALL TWO");
    const second = payAndPublish("Second permanent winner.");
    addReactions(second.messageId, 80);
    sealAutomatedWall();
    expect(monumentCatalog()).toHaveLength(2);
    const kept = monumentCatalog()[0];
    expect(kept?.text).toBe(snapshot?.text);
    expect(kept?.x).toBe(snapshot?.x);
    expect(kept?.y).toBe(snapshot?.y);
    expect(kept?.width).toBe(snapshot?.width);
    expect(kept?.height).toBe(snapshot?.height);
    expect(kept?.position).toBe(snapshot?.position);
    expect(monumentCatalog()[1]?.position).not.toBe(snapshot?.position);
    expect(monumentCatalog()[1]?.text).toBe(second.text);
  });

  it("assigns later plots from the same deterministic function", () => {
    const canvas = monumentCanvasFromEnv();
    const seen = new Set<string>();
    for (let position = 1; position <= Math.min(12, canvas.capacity); position += 1) {
      const plot = plotForPosition(position, canvas);
      const key = `${plot.x},${plot.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(plotForPosition(position, canvas)).toEqual(plot);
    }
  });

  it("finalizing the same Wall 10 times consumes one plot", () => {
    openShortLiveWall();
    const winner = payAndPublish("Idempotent victor.");
    addReactions(winner.messageId, 80);
    for (let i = 0; i < 10; i += 1) sealAutomatedWall();
    expect(monumentCatalog()).toHaveLength(1);
    expect(monumentCatalog()[0]?.text).toBe(winner.text);
    expect(monumentCatalog()[0]?.position).toBe(1);
  });

  it("has no public API that mutates Monument rows", () => {
    const apiRoot = path.join(process.cwd(), "src", "app", "api");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const next = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(next);
        else if (entry.name.endsWith(".ts") && !next.includes(`${path.sep}admin${path.sep}`)) {
          files.push(next);
        }
      }
    };
    walk(apiRoot);
    const hits = files.filter((file) => {
      const text = readFileSync(file, "utf8");
      return /from\(["']monument_entries["']\)\.(insert|update|delete)|finalize_event_rankings/.test(text);
    });
    expect(hits).toEqual([]);
  });
});
