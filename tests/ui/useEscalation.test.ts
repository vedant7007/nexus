/**
 * @vitest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { RiskLevel } from '@/lib/engine/types';
import { useEscalation } from '@/lib/ui/useEscalation';

describe('useEscalation', () => {
  it('does not fire on the first reading, however severe', () => {
    // Landing on an already-critical board must not flash a spurious escalation.
    const { result } = renderHook(({ level }) => useEscalation(level), {
      initialProps: { level: 'critical' as RiskLevel | null },
    });
    expect(result.current).toBe(0);
  });

  it('does not fire while the level is null', () => {
    const { result } = renderHook(({ level }) => useEscalation(level), {
      initialProps: { level: null as RiskLevel | null },
    });
    expect(result.current).toBe(0);
  });

  it('increments when the level rises', () => {
    const { result, rerender } = renderHook(({ level }) => useEscalation(level), {
      initialProps: { level: 'normal' as RiskLevel | null },
    });

    rerender({ level: 'elevated' });
    expect(result.current).toBe(1);
  });

  it('fires once per rise, across multiple steps', () => {
    const { result, rerender } = renderHook(({ level }) => useEscalation(level), {
      initialProps: { level: 'normal' as RiskLevel | null },
    });

    rerender({ level: 'elevated' });
    rerender({ level: 'high' });
    rerender({ level: 'critical' });
    expect(result.current).toBe(3);
  });

  it('stays put on a repeated level', () => {
    const { result, rerender } = renderHook(({ level }) => useEscalation(level), {
      initialProps: { level: 'high' as RiskLevel | null },
    });

    rerender({ level: 'high' });
    rerender({ level: 'high' });
    expect(result.current).toBe(0);
  });

  it('is silent on de-escalation — calm returning is not an alarm', () => {
    const { result, rerender } = renderHook(({ level }) => useEscalation(level), {
      initialProps: { level: 'critical' as RiskLevel | null },
    });

    rerender({ level: 'high' });
    rerender({ level: 'normal' });
    expect(result.current).toBe(0);
  });

  it('fires again when the level rises after falling', () => {
    const { result, rerender } = renderHook(({ level }) => useEscalation(level), {
      initialProps: { level: 'normal' as RiskLevel | null },
    });

    rerender({ level: 'critical' }); // rise → 1
    rerender({ level: 'normal' }); // fall → still 1
    rerender({ level: 'high' }); // rise → 2
    expect(result.current).toBe(2);
  });
});
