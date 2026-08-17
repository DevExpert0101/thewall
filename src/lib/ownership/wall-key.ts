/** Crockford-like alphabet — no 0/O/1/I/L. 16 chars = 80 bits. */
export const WALL_KEY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const WALL_KEY_LENGTH = 16;

export function normalizeWallKey(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/0/g, "")
    .replace(/1/g, "");
}

export function formatWallKey(canonical: string): string {
  const clean = normalizeWallKey(canonical);
  return clean.match(/.{1,4}/g)?.join("-") ?? clean;
}

export function isWallKey(value: string): boolean {
  const clean = normalizeWallKey(value);
  return clean.length === WALL_KEY_LENGTH && [...clean].every((ch) => WALL_KEY_ALPHABET.includes(ch));
}

export function isLegacyOwnershipToken(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value.trim());
}

export function isOwnershipSecret(value: string): boolean {
  return isWallKey(value) || isLegacyOwnershipToken(value);
}

const KEY_CHAR = "[A-HJ-KM-NP-Z2-9]";
const GROUPED_KEY = new RegExp(`\\b${KEY_CHAR}{4}(?:-${KEY_CHAR}{4}){3}\\b`, "g");
const BARE_KEY = new RegExp(`\\b${KEY_CHAR}{16}\\b`, "g");
const LEGACY_HEX = /\b[0-9a-f]{64}\b/gi;

export function looksLikeOwnershipSecret(value: string): boolean {
  const trimmed = value.trim();
  return isOwnershipSecret(trimmed);
}

export function redactOwnershipSecrets(value: string): string {
  return value
    .replace(GROUPED_KEY, "[redacted]")
    .replace(BARE_KEY, "[redacted]")
    .replace(LEGACY_HEX, "[redacted]");
}
