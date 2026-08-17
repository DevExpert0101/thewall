type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  inflight?: Promise<T>;
};

const store = new Map<string, CacheEntry<unknown>>();
const MAX_ENTRIES = 256;

export const EVENT_SNAPSHOT_TTL_MS = 3_000;
export const RANKED_FEED_TTL_MS = 5_000;

function evict() {
  if (store.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now && !entry.inflight) {
      store.delete(key);
    }
    if (store.size <= MAX_ENTRIES) return;
  }
  const oldest = store.keys().next().value;
  if (oldest) store.delete(oldest);
}

/** Per-isolate TTL with single-flight. Absorbs a stampede on one Vercel instance. */
export function remember<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as CacheEntry<T> | undefined;
  if (hit?.value !== undefined && hit.expiresAt > now) {
    return Promise.resolve(hit.value);
  }
  if (hit?.inflight) {
    return hit.inflight;
  }

  const inflight = load()
    .then((value) => {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      evict();
      return value;
    })
    .catch((error) => {
      store.delete(key);
      throw error;
    });

  store.set(key, { expiresAt: now + ttlMs, inflight });
  return inflight;
}

export function resetRemembered() {
  store.clear();
}
