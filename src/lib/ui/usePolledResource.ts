'use client';

// The single piece of fetching machinery in the UI; every data hook composes it,
// so retry, abort, and the loading/error/stale rules behave identically everywhere.
//
// The state is deliberately richer than `{data, loading}`: it distinguishes *no
// data yet* from *data that failed to refresh*. A control room showing
// three-second-old numbers during a blip is correct; blanking to a spinner
// because one poll failed is not.
import { useCallback, useEffect, useState } from 'react';

import type { ApiError, ApiResult } from './apiClient';

/** The state of a polled resource. */
export interface PolledResource<T> {
  /** The most recent successful value, retained across failed refreshes. */
  data: T | null;
  /** True only before the first value arrives — not on every refresh. */
  loading: boolean;
  /** The most recent failure, or null. */
  error: ApiError | null;
  /** True when data is present but the latest refresh failed. */
  stale: boolean;
  /** Forces an immediate refresh. */
  refresh: () => void;
}

/**
 * Fetches a resource on an interval.
 *
 * **The `fetcher` must be memoised**, normally with `useCallback` over exactly
 * the inputs the request depends on. Its identity is a dependency of the effect,
 * which is what makes a changed input (a new scenario, a new tick) refetch. Pass
 * an unmemoised arrow and it will refetch on every render.
 *
 * That contract is deliberate. An earlier version held the fetcher in a ref to
 * be defensive about the stampede case, and the result was worse than a
 * stampede: changing the scenario silently did not refetch, so the picker
 * looked like it worked and showed the previous scenario's numbers. When a hook
 * has to choose between being hard to misuse and being correct when used
 * properly, correct wins — and a test pins it.
 *
 * Pass `intervalMs` 0 to fetch only when inputs change.
 */
export function usePolledResource<T>(
  fetcher: (signal: AbortSignal) => Promise<ApiResult<T>>,
  intervalMs: number,
  enabled = true,
): PolledResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    let cancelled = false;

    const run = async (): Promise<void> => {
      try {
        const result = await fetcher(controller.signal);
        if (cancelled) return;

        if (result.ok) {
          setData(result.value);
          setError(null);
        } else {
          // Keep the last good value: stale numbers beat no numbers.
          setError(result.error);
        }
      } catch {
        // An abort during unmount or a re-poll. Not a failure to report.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    const timer = intervalMs > 0 ? setInterval(() => void run(), intervalMs) : undefined;

    return () => {
      cancelled = true;
      controller.abort();
      if (timer !== undefined) clearInterval(timer);
    };
  }, [fetcher, intervalMs, enabled, nonce]);

  return { data, loading, error, stale: data !== null && error !== null, refresh };
}
