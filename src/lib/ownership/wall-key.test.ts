import { describe, expect, it } from "vitest";
import { createWallKey, hashOwnershipSecret, hashWallKey } from "@/lib/crypto";
import {
  formatWallKey,
  isWallKey,
  looksLikeOwnershipSecret,
  normalizeWallKey,
  redactOwnershipSecrets,
} from "@/lib/ownership/wall-key";

describe("Wall Key", () => {
  it("issues a grouped 16-character key and hashes the canonical form", () => {
    for (let i = 0; i < 32; i += 1) {
      const key = createWallKey();
      expect(isWallKey(key)).toBe(true);
      expect(key).toMatch(/^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/);
      expect(normalizeWallKey(key)).toHaveLength(16);
      expect(hashWallKey(key)).toBe(hashWallKey(normalizeWallKey(key)));
    }
    expect(hashWallKey("7K9P-X4MF-82QH-K3R2")).not.toBe(hashWallKey("AAAA-AAAA-AAAA-AAAB"));
  });

  it("treats dashes as presentation only", () => {
    expect(formatWallKey("7K9PX4MF82QHK3R2")).toBe("7K9P-X4MF-82QH-K3R2");
    expect(isWallKey("7k9p x4mf 82qh k3r2")).toBe(true);
  });

  it("hashes legacy 64-hex tokens differently from Wall Keys", () => {
    const hex = "a".repeat(64);
    expect(hashOwnershipSecret(hex)).toHaveLength(64);
    expect(hashOwnershipSecret("7K9P-X4MF-82QH-K3R2")).not.toBe(hashOwnershipSecret(hex));
  });

  it("redacts grouped keys, bare keys, and legacy tokens", () => {
    expect(looksLikeOwnershipSecret("7K9P-X4MF-82QH-K3R2")).toBe(true);
    expect(redactOwnershipSecrets("saved 7K9P-X4MF-82QH-K3R2 locally")).toBe(
      "saved [redacted] locally",
    );
    expect(redactOwnershipSecrets("bare 7K9PX4MF82QHK3R2 key")).toBe("bare [redacted] key");
    expect(redactOwnershipSecrets(`legacy ${"ab".repeat(32)}`)).toBe("legacy [redacted]");
  });
});
