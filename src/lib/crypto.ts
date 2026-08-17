import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  WALL_KEY_ALPHABET,
  WALL_KEY_LENGTH,
  formatWallKey,
  isLegacyOwnershipToken,
  isWallKey,
  normalizeWallKey,
} from "@/lib/ownership/wall-key";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function hashWallKey(value: string): string {
  return sha256Hex(normalizeWallKey(value));
}

export function hashOwnershipSecret(value: string): string {
  const trimmed = value.trim();
  if (isLegacyOwnershipToken(trimmed)) return hashToken(trimmed.toLowerCase());
  return hashWallKey(trimmed);
}

export function createOwnershipToken(): string {
  return randomBytes(32).toString("hex");
}

export function createWallKey(): string {
  const alphabet = WALL_KEY_ALPHABET.length;
  const limit = Math.floor(256 / alphabet) * alphabet;
  let canonical = "";
  while (canonical.length < WALL_KEY_LENGTH) {
    const byte = randomBytes(1)[0] ?? 255;
    if (byte >= limit) continue;
    canonical += WALL_KEY_ALPHABET[byte % alphabet];
  }
  return formatWallKey(canonical);
}

export function assertWallKey(value: string): string {
  if (!isWallKey(value)) {
    throw new Error("Invalid Wall Key.");
  }
  return formatWallKey(value);
}

export function tokensEqual(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}
