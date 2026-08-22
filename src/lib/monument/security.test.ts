import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

describe("Monument write surface", () => {
  it("has no public API that can create or alter a Monument entry", () => {
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
      return /monument_entries|winning_message_id|finalize_event_rankings/.test(text);
    });
    expect(hits).toEqual([]);
  });
});
