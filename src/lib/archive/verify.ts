/** Short public reading of a SHA-256 hex: 9BF2...A812 */
export function formatArchiveFingerprint(hex: string): string {
  const clean = hex.replace(/[^0-9a-f]/gi, "").toUpperCase();
  if (clean.length < 8) return clean;
  return `${clean.slice(0, 4)}...${clean.slice(-4)}`;
}

export function fingerprintsMatch(stored: string | null | undefined, computed: string | null | undefined): boolean {
  if (!stored || !computed) return false;
  return stored.replace(/[^0-9a-f]/gi, "").toLowerCase() === computed.replace(/[^0-9a-f]/gi, "").toLowerCase();
}
