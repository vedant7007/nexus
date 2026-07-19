'use client';

import { useRef } from 'react';

/**
 * A stable ref whose `current` is always the latest value.
 *
 * The AI hooks need the current tick when a request fires, but must not
 * re-create their fetcher every three seconds when the clock advances — doing
 * so would restart the poll and turn a 20-second cadence into a 3-second one,
 * emptying the rate-limit budget in a minute. This reads the tick at call time
 * instead of capturing it as a dependency.
 */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
