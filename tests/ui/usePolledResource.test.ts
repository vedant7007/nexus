/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ApiResult } from '@/lib/ui/apiClient';
import { usePolledResource } from '@/lib/ui/usePolledResource';

/** A successful result. */
const ok = (value: number): ApiResult<number> => ({ ok: true, value });

/** A failed result. */
const fail = (): ApiResult<number> => ({
  ok: false,
  error: { code: 'network', message: 'Could not reach the server.' },
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('usePolledResource', () => {
  it('fetches once and exposes the value', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok(1));
    const { result } = renderHook(() => usePolledResource(fetcher, 0));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it('starts in a loading state with no data', () => {
    const { result } = renderHook(() => usePolledResource(vi.fn().mockResolvedValue(ok(1)), 0));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it('reports an error when the first fetch fails', async () => {
    const { result } = renderHook(() => usePolledResource(vi.fn().mockResolvedValue(fail()), 0));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.code).toBe('network');
    expect(result.current.data).toBeNull();
  });

  /** The property that keeps a control room usable through a blip. */
  it('keeps the last good value when a refresh fails, and marks it stale', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok(1)).mockResolvedValue(fail());
    const { result } = renderHook(() => usePolledResource(fetcher, 0));

    await waitFor(() => expect(result.current.data).toBe(1));

    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.error).not.toBeNull());

    // Stale numbers beat no numbers: the panel must not blank.
    expect(result.current.data).toBe(1);
    expect(result.current.stale).toBe(true);
  });

  it('clears the error once a refresh succeeds again', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(fail()).mockResolvedValue(ok(2));
    const { result } = renderHook(() => usePolledResource(fetcher, 0));

    await waitFor(() => expect(result.current.error).not.toBeNull());

    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.data).toBe(2));

    expect(result.current.error).toBeNull();
    expect(result.current.stale).toBe(false);
  });

  it('does not fetch when disabled', () => {
    const fetcher = vi.fn().mockResolvedValue(ok(1));
    renderHook(() => usePolledResource(fetcher, 0, false));

    expect(fetcher).not.toHaveBeenCalled();
  });

  it('polls on the interval', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue(ok(1));
    renderHook(() => usePolledResource(fetcher, 1_000));

    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(3_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('does not poll when the interval is zero', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue(ok(1));
    renderHook(() => usePolledResource(fetcher, 0));

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('stops polling on unmount', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue(ok(1));
    const { unmount } = renderHook(() => usePolledResource(fetcher, 1_000));

    unmount();
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('aborts the in-flight request on unmount', async () => {
    let captured: AbortSignal | undefined;
    const fetcher = vi.fn((signal: AbortSignal) => {
      captured = signal;
      return Promise.resolve(ok(1));
    });

    const { unmount } = renderHook(() => usePolledResource(fetcher, 0));
    unmount();

    expect(captured?.aborted).toBe(true);
  });

  it('swallows an abort rather than surfacing it as an error', async () => {
    const fetcher = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    const { result } = renderHook(() => usePolledResource(fetcher, 0));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
  });

  /**
   * The regression this hook exists to avoid. Holding the fetcher in a ref made
   * a changed input silently not refetch, so the scenario picker looked like it
   * worked while showing the previous scenario's numbers.
   */
  it('refetches when the fetcher changes, because that means its inputs changed', async () => {
    const first = vi.fn().mockResolvedValue(ok(1));
    const second = vi.fn().mockResolvedValue(ok(2));

    const { result, rerender } = renderHook(({ f }) => usePolledResource(f, 0), {
      initialProps: { f: first },
    });

    await waitFor(() => expect(result.current.data).toBe(1));
    rerender({ f: second });

    await waitFor(() => expect(result.current.data).toBe(2));
    expect(second).toHaveBeenCalled();
  });

  it('aborts the previous request when inputs change mid-flight', async () => {
    const signals: AbortSignal[] = [];
    const make = (value: number) =>
      vi.fn((signal: AbortSignal) => {
        signals.push(signal);
        return Promise.resolve(ok(value));
      });

    const { rerender } = renderHook(({ f }) => usePolledResource(f, 0), {
      initialProps: { f: make(1) },
    });
    rerender({ f: make(2) });

    await waitFor(() => expect(signals.length).toBe(2));
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
  });
});
