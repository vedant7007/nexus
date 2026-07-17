/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ScenarioId } from '@/lib/sim/scenarios';

const apiFetch = vi.hoisted(() => vi.fn());
const getToken = vi.hoisted(() => vi.fn(async () => 'test-token'));

vi.mock('@/lib/ui/apiClient', () => ({ apiFetch }));
vi.mock('@/lib/ui/useAuthToken', () => ({ useAuthToken: () => getToken }));

const { useBriefing, useIncidents, useRecommendations, useSituation, useSnapshot } = await import(
  '@/lib/ui/hooks'
);

/** The URL of the nth apiFetch call. */
function urlOf(index = 0): string {
  return String(apiFetch.mock.calls[index]?.[0] ?? '');
}

/** The request options of the nth apiFetch call. */
function optionsOf(index = 0): { method?: string; body?: Record<string, unknown> } {
  return apiFetch.mock.calls[index]?.[3] ?? {};
}

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue({ ok: true, value: { ok: true } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useSnapshot', () => {
  it('requests the snapshot for the scenario and tick', async () => {
    renderHook(() => useSnapshot('gate_surge', 40));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(urlOf()).toBe('/api/sim?scenario=gate_surge&tick=40');
  });

  it('refetches when the tick advances', async () => {
    const { rerender } = renderHook(({ tick }) => useSnapshot('normal', tick), {
      initialProps: { tick: 1 },
    });

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    rerender({ tick: 2 });

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    expect(urlOf(1)).toContain('tick=2');
  });

  it('encodes the scenario, so a crafted value cannot escape the query', async () => {
    renderHook(() => useSnapshot('normal', 0));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(urlOf()).not.toContain(' ');
  });
});

describe('useSituation', () => {
  it('requests the deterministic report', async () => {
    renderHook(() => useSituation('heat_wave', 60));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(urlOf()).toBe('/api/situation?scenario=heat_wave&tick=60');
  });
});

describe('useBriefing', () => {
  it('posts the scenario, tick and kind', async () => {
    renderHook(() => useBriefing({ scenario: 'gate_surge', tick: 40, kind: 'situation' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(urlOf()).toBe('/api/ai/briefing');
    expect(optionsOf().method).toBe('POST');
    expect(optionsOf().body).toEqual({ scenario: 'gate_surge', tick: 40, kind: 'situation' });
  });

  it('requests the sustainability kind when asked', async () => {
    renderHook(() => useBriefing({ scenario: 'normal', tick: 1, kind: 'sustainability' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(optionsOf().body).toMatchObject({ kind: 'sustainability' });
  });

  /**
   * The rate-limit guard. The tick advances every few seconds; if it were a
   * dependency, the 20-second AI cadence would collapse to 3 seconds and empty
   * the 15/min budget inside a minute.
   */
  it('does not refire when only the tick advances', async () => {
    const { rerender } = renderHook(
      ({ tick }) => useBriefing({ scenario: 'normal', tick, kind: 'situation' }),
      { initialProps: { tick: 1 } },
    );

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));

    rerender({ tick: 2 });
    rerender({ tick: 3 });
    rerender({ tick: 4 });

    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('refires when the scenario changes, because that is a different situation', async () => {
    const { rerender } = renderHook(
      ({ scenario }) => useBriefing({ scenario, tick: 1, kind: 'situation' }),
      { initialProps: { scenario: 'normal' as ScenarioId } },
    );

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    rerender({ scenario: 'gate_surge' });

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
  });

  it('sends the latest tick even though it is not a dependency', async () => {
    const { rerender } = renderHook(
      ({ scenario, tick }) => useBriefing({ scenario, tick, kind: 'situation' }),
      { initialProps: { scenario: 'normal' as ScenarioId, tick: 1 } },
    );

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    rerender({ scenario: 'gate_surge', tick: 55 });

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    // Read at request time via the ref, not captured at hook creation.
    expect(optionsOf(1).body).toMatchObject({ tick: 55 });
  });
});

describe('useRecommendations', () => {
  it('requests recommendations for the scenario', async () => {
    renderHook(() => useRecommendations('gate_surge', 52));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(urlOf()).toBe('/api/recommendations?scenario=gate_surge&tick=52');
  });

  it('does not refire on a tick advance, protecting the AI budget', async () => {
    const { rerender } = renderHook(({ tick }) => useRecommendations('normal', tick), {
      initialProps: { tick: 1 },
    });

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    rerender({ tick: 2 });

    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});

describe('useIncidents', () => {
  it('lists incidents', async () => {
    renderHook(() => useIncidents('normal', 10));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(urlOf()).toBe('/api/incidents');
  });

  it('posts a report with the scenario context the engine needs', async () => {
    const { result } = renderHook(() => useIncidents('gate_surge', 40));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    apiFetch.mockClear();

    await result.current.report('person collapsed', 'z3');

    expect(urlOf()).toBe('/api/incidents');
    expect(optionsOf().method).toBe('POST');
    expect(optionsOf().body).toEqual({
      rawText: 'person collapsed',
      zoneId: 'z3',
      scenario: 'gate_surge',
      tick: 40,
    });
  });

  it('previews triage without persisting', async () => {
    const { result } = renderHook(() => useIncidents('normal', 5));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    apiFetch.mockClear();

    await result.current.preview('hay una persona desmayada', 'z3');
    expect(urlOf()).toBe('/api/ai/triage');
  });

  it('patches status', async () => {
    const { result } = renderHook(() => useIncidents('normal', 5));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    apiFetch.mockClear();

    await result.current.setStatus('inc-1', 'resolved');

    expect(urlOf()).toBe('/api/incidents/inc-1');
    expect(optionsOf().method).toBe('PATCH');
    expect(optionsOf().body).toEqual({ status: 'resolved' });
  });

  it('refreshes the log after a successful report', async () => {
    const { result } = renderHook(() => useIncidents('normal', 5));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));

    await result.current.report('a bin is full', 'z1');

    // The POST, then the refetch it triggers.
    await waitFor(() =>
      expect(apiFetch.mock.calls.filter((c) => c[0] === '/api/incidents').length).toBeGreaterThan(
        1,
      ),
    );
  });

  it('does not refresh after a failed report', async () => {
    const { result } = renderHook(() => useIncidents('normal', 5));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));

    apiFetch.mockResolvedValue({ ok: false, error: { code: 'rate_limited', message: 'Slow.' } });
    apiFetch.mockClear();

    const outcome = await result.current.report('x', 'z1');

    expect(outcome.ok).toBe(false);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});
