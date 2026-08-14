import { formatWallKey, isOwnershipSecret, isWallKey } from "@/lib/ownership/wall-key";

export const OWNED_MESSAGES_KEY = "thewall:owned_messages";
export const CERT_PREFIX = "thewall:cert:";

export type OwnedMark = {
  message: number;
  claimKey: string;
  text?: string;
  publishedAt?: string;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function readList(): OwnedMark[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(OWNED_MESSAGES_KEY);
    if (!raw) return migrateLegacy();
    const parsed = JSON.parse(raw) as OwnedMark[];
    if (!Array.isArray(parsed)) return migrateLegacy();
    return parsed.filter((row) => Number.isInteger(row.message) && isOwnershipSecret(row.claimKey));
  } catch {
    return migrateLegacy();
  }
}

function migrateLegacy(): OwnedMark[] {
  if (!canUseStorage()) return [];
  const found: OwnedMark[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(CERT_PREFIX)) continue;
      const message = Number(key.slice(CERT_PREFIX.length));
      const claimKey = window.localStorage.getItem(key);
      if (!Number.isInteger(message) || !claimKey || !isOwnershipSecret(claimKey)) continue;
      found.push({ message, claimKey });
    }
  } catch {
    return [];
  }
  if (found.length > 0) writeList(found);
  return found;
}

function writeList(rows: OwnedMark[]) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(OWNED_MESSAGES_KEY, JSON.stringify(rows));
  } catch {
    // private convenience only
  }
}

export function listOwnedMarks(): OwnedMark[] {
  return readList();
}

export function getOwnedMark(publicNumber: number): OwnedMark | null {
  return readList().find((row) => row.message === publicNumber) ?? null;
}

export function rememberOwnedMark(mark: OwnedMark) {
  const claimKey = isWallKey(mark.claimKey) ? formatWallKey(mark.claimKey) : mark.claimKey;
  const next = readList().filter((row) => row.message !== mark.message);
  next.unshift({ ...mark, claimKey });
  writeList(next.slice(0, 48));
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(`${CERT_PREFIX}${mark.message}`, claimKey);
  } catch {
    // ignore
  }
}
