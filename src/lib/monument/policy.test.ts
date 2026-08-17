import { describe, expect, it } from "vitest";
import { parseMonumentCapacity, VICTOR_TIE_POLICY, winningMargin } from "@/lib/monument/policy";

describe("Victor policy", () => {
  it("documents a deterministic tie order without randomness", () => {
    expect(VICTOR_TIE_POLICY).toMatch(/highest 🔥/i);
    expect(VICTOR_TIE_POLICY).toMatch(/earlier published/i);
    expect(VICTOR_TIE_POLICY).toMatch(/lower inscription number/i);
    expect(VICTOR_TIE_POLICY).not.toMatch(/random/i);
  });

  it("stores winner 🔥 minus second place", () => {
    expect(winningMargin(491283, 481002)).toBe(10281);
    expect(winningMargin(12, null)).toBe(12);
    expect(winningMargin(4, 9)).toBe(0);
  });

  it("does not invent a Monument capacity", () => {
    expect(parseMonumentCapacity(undefined)).toBeNull();
    expect(parseMonumentCapacity("")).toBeNull();
    expect(parseMonumentCapacity("0")).toBeNull();
    expect(parseMonumentCapacity("1000")).toBe(1000);
  });
});
