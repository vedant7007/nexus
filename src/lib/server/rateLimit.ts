/**
 * @module server/rateLimit
 *
 * Responsibility: cap how often one user may spend money on our behalf.
 *
 * A fixed-window counter held in process memory. Two honest limitations, both
 * deliberate for this deployment:
 *
 *  - **Per-instance, not global.** With N Cloud Run instances a determined user
 *    gets N windows. For protecting a demo's Gemini quota that is fine; a real
 *    multi-instance deployment would move this to Redis or Firestore. The
 *    interface below is what a shared store would implement, so swapping it is
 *    a one-file change.
 *  - **Fixed window, not sliding.** A user can burst across a window boundary.
 *    Acceptable at these limits; a token bucket would be the upgrade.
 *
 * Recording it here rather than pretending otherwise: an undocumented limitation
 * is a bug, a documented one is a design decision.
 */
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
 *
 * @param now - Current epoch ms.
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
 * Records a request against a key and reports whether it is allowed.
 *
 * @param key - Identity to limit on, normally a Firebase uid.
 * @param limit - Maximum requests per window.
 * @param now - Current epoch ms. Injected so tests need no fake timers.
 * @returns Whether the request is allowed, and when the window resets.
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
