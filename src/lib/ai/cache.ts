// Reuse a real AI response when the same situation recurs. The simulator is
// deterministic and situations repeat, so regenerating is wasted latency and quota.
// Two invariants keep it honest: only *successful* AI results are cached (a fallback
// is never stored, so a rule-mode answer can't masquerade as mode:'ai' and a
// transient outage isn't pinned for the whole TTL), and the key carries everything
// that changes the answer, so different situations never collide. In-process and
// per-instance, like the rate limiter — the obvious seam to swap for a shared store.

/** Default lifetime of a cached AI response. */
export const AI_CACHE_TTL_MS = 5 * 60_000;

interface Entry<T> {
  value: T;
  expiresAt: number;
}

/** Bounds memory: distinct situations are few, but incident texts are open-ended. */
const MAX_ENTRIES = 500;

const store = new Map<string, Entry<unknown>>();

/**
 * Returns a cached AI result, or computes and caches a fresh one.
 *
 * The computed value is stored only when `shouldCache` accepts it — used to
 * cache `mode: 'ai'` results but never fallbacks. The key must capture every
 * input that changes the output.
 */
export async function cachedAi<T>(
  key: string,
  compute: () => Promise<T>,
  shouldCache: (value: T) => boolean,
  now: number = Date.now(),
  ttlMs: number = AI_CACHE_TTL_MS,
): Promise<T> {
  const hit = store.get(key);
  if (hit !== undefined && hit.expiresAt > now) {
    return hit.value as T;
  }

  const value = await compute();

  if (shouldCache(value)) {
    if (store.size >= MAX_ENTRIES) sweep(now);
    store.set(key, { value, expiresAt: now + ttlMs });
  }
  return value;
}

// Drops expired entries, then — if still at capacity — the oldest, so an
// open-ended stream of incident texts cannot grow the map without bound.
function sweep(now: number): void {
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
  while (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/** Empties the cache. Test-only seam. */
export function resetAiCache(): void {
  store.clear();
}
