'use client';

import { useEffect, useState } from 'react';

/**
 * Returns `value` only after it has held steady for `delayMs`.
 *
 * Used on the overall risk level that drives AI-panel revalidation. The
 * simulator's ±3% sensor jitter can flip the level across a band boundary
 * (elevated ↔ high) every few seconds, and without settling, each flip would
 * spend a Gemini call re-fetching a briefing that then flips back. A short
 * debounce absorbs that oscillation while still passing a *sustained* change —
 * a real escalation holds for many seconds — through with only `delayMs` of lag.
 * The deterministic status pill is undebounced, so the live status is never
 * delayed; only the costlier AI refresh waits for the value to mean something.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
