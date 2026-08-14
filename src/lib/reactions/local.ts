const STORAGE_KEY = "thewall:reacted";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function readIds(): string[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

function writeIds(ids: string[]) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, 400)));
  } catch {
    // convenience only
  }
}

export function hasLocalReaction(messageId: string): boolean {
  return readIds().includes(messageId);
}

export function rememberLocalReaction(messageId: string) {
  const ids = readIds();
  if (ids.includes(messageId)) return;
  writeIds([messageId, ...ids]);
}
