/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { cachedAi, resetAiCache } from '@/lib/ai/cache';

afterEach(() => {
  resetAiCache();
});

/** A small result shape mirroring the AI results the cache actually holds. */
interface Result {
  mode: 'ai' | 'rule';
  text?: string;
}

const isAi = (v: Result): boolean => v.mode === 'ai';

describe('cachedAi', () => {
  it('computes on a miss and serves the cached value on a hit', async () => {
    const compute = vi.fn(async (): Promise<Result> => ({ mode: 'ai', text: 'x' }));

    const first = await cachedAi('k', compute, isAi);
    const second = await cachedAi('k', compute, isAi);

    expect(first).toBe(second);
    expect(compute).toHaveBeenCalledTimes(1); // second was a hit
  });

  /** The honesty invariant: a fallback is never cached. */
  it('never caches a value the predicate rejects', async () => {
    const compute = vi.fn(async (): Promise<Result> => ({ mode: 'rule' }));

    await cachedAi('k', compute, isAi);
    await cachedAi('k', compute, isAi);

    // Both missed because a rule-mode result is never stored.
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('does not let a transient failure poison a later success', async () => {
    const compute = vi
      .fn<() => Promise<Result>>()
      .mockResolvedValueOnce({ mode: 'rule' })
      .mockResolvedValue({ mode: 'ai', text: 'good' });

    const failed = await cachedAi('k', compute, isAi);
    const recovered = await cachedAi('k', compute, isAi);
    const cached = await cachedAi('k', compute, isAi);

    expect(failed.mode).toBe('rule');
    expect(recovered.mode).toBe('ai');
    expect(cached).toBe(recovered); // now served from cache
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('separates distinct keys', async () => {
    const a = await cachedAi(
      'a',
      async () => ({ mode: 'ai', v: 1 }),
      () => true,
    );
    const b = await cachedAi(
      'b',
      async () => ({ mode: 'ai', v: 2 }),
      () => true,
    );

    expect(a).not.toBe(b);
  });

  it('recomputes after the TTL expires', async () => {
    const compute = vi.fn(async (): Promise<Result> => ({ mode: 'ai' }));

    await cachedAi('k', compute, isAi, 1_000, 5_000); // stored, expires at 6000
    await cachedAi('k', compute, isAi, 3_000, 5_000); // hit
    await cachedAi('k', compute, isAi, 7_000, 5_000); // expired → recompute

    expect(compute).toHaveBeenCalledTimes(2);
  });
});
