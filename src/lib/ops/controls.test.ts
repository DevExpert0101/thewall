import { describe, expect, it } from "vitest";
import {
  defaultEventOps,
  mergeEventConfiguration,
  opsEqual,
  parseEventOps,
} from "@/lib/ops/controls";

describe("event ops controls", () => {
  it("defaults to publishing and reactions on, and react Turnstile off", () => {
    expect(defaultEventOps()).toEqual({
      publishEnabled: true,
      reactEnabled: true,
      strictBot: false,
    });
    expect(parseEventOps(undefined)).toEqual(defaultEventOps());
    expect(parseEventOps({})).toEqual(defaultEventOps());
  });

  it("reads nested ops without inventing other configuration keys", () => {
    const merged = mergeEventConfiguration({ theme: "stone", ops: { extra: true } }, {
      publishEnabled: false,
      reactEnabled: true,
      strictBot: true,
    });
    expect(merged.theme).toBe("stone");
    expect(parseEventOps(merged)).toEqual({
      publishEnabled: false,
      reactEnabled: true,
      strictBot: true,
    });
    expect(opsEqual(parseEventOps(merged), defaultEventOps())).toBe(false);
  });
});
