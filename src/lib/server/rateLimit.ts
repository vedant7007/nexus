// A fixed-window counter held in process memory. Two deliberate limitations:
//  - Per-instance, not global: with N Cloud Run instances a user gets N windows.
//    Fine for protecting a demo's Gemini quota; a real multi-instance deployment
//    would move this behind the interface below to Redis or Firestore.
//  - Fixed window, not sliding: a user can burst across a window boundary.
//    Acceptable at these limits; a token bucket would be the upgrade.
import { AI_RATE_LIMIT_PER_MIN } from '../config';

/** Window length in milliseconds. */
const WINDOW_MS = 60_000;

/** How many stale entries to tolerate before sweeping. Bounds memory growth. */
const SWEEP_THRESHOLD = 1_000;

interface Window {
  count: number;
  /** Epoch ms at which this window resets. */
  resetAt: number;
}

const windows = new Map<string, Window>();

/**
 * Drops expired windows so an unbounded stream of user ids cannot grow the map
 * forever. Called only when the map is already large, so the common path stays
 * O(1).
 */
function sweep(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/** The outcome of a rate-limit check. */
export interface RateLimitResult {
  allowed: boolean;
  /** Requests left in the current window. */
  remaining: number;
  /** Seconds until the window resets. */
  retryAfterSec: number;
}

/**
 * Records a request against a key (normally a Firebase uid) and reports whether
 * it is allowed. `now` is injected so tests need no fake timers.
 */
export function checkRateLimit(
  key: string,
  limit: number = AI_RATE_LIMIT_PER_MIN,
  now: number = Date.now(),
): RateLimitResult {
  if (windows.size > SWEEP_THRESHOLD) sweep(now);

  const existing = windows.get(key);
  const window: Window =
    existing === undefined || existing.resetAt <= now
      ? { count: 0, resetAt: now + WINDOW_MS }
      : existing;

  window.count += 1;
  windows.set(key, window);

  const retryAfterSec = Math.max(1, Math.ceil((window.resetAt - now) / 1000));
  return {
    allowed: window.count <= limit,
    remaining: Math.max(0, limit - window.count),
    retryAfterSec,
  };
}

/** Clears all windows. Test-only seam. */
export function resetRateLimits(): void {
  windows.clear();
}
