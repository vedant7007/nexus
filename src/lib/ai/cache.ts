/**
 * @module ai/cache
 *
 * Responsibility: reuse a real AI response when the same situation recurs.
 *
 * The simulator is deterministic and situations repeat constantly — a dashboard
 * polls the same `(scenario, level)` every cadence, and a second operator on the
 * same scenario sees the identical picture. Regenerating an AI briefing for each
 * of those is wasted latency and, on a metered key, wasted quota. This caches
 * the *successful* AI output for a short window so the first request pays for it
 * and the rest are instant.
 *
 * Two invariants keep it honest:
 *
 *  - **Only successful AI results are cached.** A fallback is never stored, so
 *    the cache can never make a rule-mode answer masquerade as `mode: 'ai'`, and
 *    a transient outage does not get pinned for the whole TTL.
 *  - **The key carries everything that changes the answer** (scenario, risk
 *    level, kind, or the incident text). Different situations never collide.
 *
 * In-process and per-instance, like the rate limiter — a pragmatic fit for this
 * deployment, and the obvious seam to swap for a shared store later.
 */

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
 * cache `mode: 'ai'` results but never fallbacks.
 *
 * @param key - Cache key; must capture every input that changes the output.
 * @param compute - Produces the value on a miss.
 * @param shouldCache - Predicate deciding whether a computed value is cacheable.
 * @param now - Current epoch ms. Injected for tests.
 * @param ttlMs - Entry lifetime.
 * @returns The cached or freshly computed value.
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

/**
 * Drops expired entries, then — if still at capacity — the oldest, so an
 * open-ended stream of incident texts cannot grow the map without bound.
 *
 * @param now - Current epoch ms.
 */
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
