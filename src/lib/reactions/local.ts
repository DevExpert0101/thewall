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

const IDEM_PREFIX = "thewall:react-idem:";

export function reactionIdempotencyKey(messageId: string): string {
  if (!canUseStorage()) return crypto.randomUUID();
  const key = `${IDEM_PREFIX}${messageId}`;
  try {
    const existing = window.localStorage.getItem(key);
    if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) {
      return existing;
    }
    const next = crypto.randomUUID();
    window.localStorage.setItem(key, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}
