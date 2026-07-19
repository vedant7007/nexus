/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedValue } from '@/lib/ui/useDebouncedValue';

afterEach(() => {
  vi.useRealTimers();
});

/** Advances fake timers inside act, flushing the effects they trigger. */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

describe('useDebouncedValue', () => {
  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('a', 1000));
    expect(result.current).toBe('a');
  });

  it('emits a change only after it holds for the delay', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 1000), {
      initialProps: { v: 'a' },
    });

    rerender({ v: 'b' });
    expect(result.current).toBe('a'); // not yet

    await advance(1000);
    expect(result.current).toBe('b');
  });

  /** The point of the hook: rapid flapping is absorbed. */
  it('absorbs oscillation that never settles', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 1000), {
      initialProps: { v: 'high' },
    });

    // Flap every 500ms — shorter than the 1000ms settle — so nothing is emitted.
    for (let i = 0; i < 6; i += 1) {
      rerender({ v: i % 2 === 0 ? 'elevated' : 'high' });
      await advance(500);
    }
    expect(result.current).toBe('high'); // still the original

    rerender({ v: 'critical' });
    await advance(1000);
    expect(result.current).toBe('critical');
  });

  it('passes a sustained escalation through after the delay', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 1000), {
      initialProps: { v: 'normal' as string | undefined },
    });

    rerender({ v: 'critical' });
    await advance(1000);
    expect(result.current).toBe('critical');
  });
});
