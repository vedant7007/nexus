'use client';

// Every data-fetching concern the command center has. Components import from
// here and render what they are handed — none calls `fetch`, knows a URL, or
// owns a polling interval, which keeps them small and testable with plain props.
import { useCallback } from 'react';

import type { IncidentStatus } from '../engine/types';
import {
  type BriefingDto,
  type IncidentDto,
  type RecommendationsDto,
  type SituationReportDto,
  type SnapshotDto,
  type TriagePreviewDto,
  briefingResponseSchema,
  incidentListSchema,
  incidentSchema,
  recommendationsResponseSchema,
  situationReportSchema,
  snapshotSchema,
  triagePreviewSchema,
} from '../schemas/api';
import type { ScenarioId } from '../sim/scenarios';

import { type ApiResult, apiFetch } from './apiClient';
import { BRIEFING_REFRESH_MS, INCIDENTS_POLL_MS, RECOMMENDATIONS_REFRESH_MS } from './constants';
import { useAuthToken } from './useAuthToken';
import { useLatest } from './useLatest';
import { type PolledResource, usePolledResource } from './usePolledResource';

// Query string for a scenario and tick.
function query(scenario: ScenarioId, tick: number): string {
  return `?scenario=${encodeURIComponent(scenario)}&tick=${tick}`;
}

/** Polls the live venue snapshot. */
export function useSnapshot(scenario: ScenarioId, tick: number): PolledResource<SnapshotDto> {
  const getToken = useAuthToken();
  const fetcher = useCallback(
    (signal: AbortSignal) =>
      apiFetch(`/api/sim${query(scenario, tick)}`, snapshotSchema, getToken, { signal }),
    [scenario, tick, getToken],
  );
  // Interval 0: the tick is driven by the dashboard clock, so this refetches
  // when the tick changes rather than on a second, competing timer.
  return usePolledResource(fetcher, 0);
}

/** Polls the deterministic situation report. */
export function useSituation(
  scenario: ScenarioId,
  tick: number,
): PolledResource<SituationReportDto> {
  const getToken = useAuthToken();
  const fetcher = useCallback(
    (signal: AbortSignal) =>
      apiFetch(`/api/situation${query(scenario, tick)}`, situationReportSchema, getToken, {
        signal,
      }),
    [scenario, tick, getToken],
  );
  return usePolledResource(fetcher, 0);
}

/** A briefing, keyed to a scenario and refreshed on its own slow cadence. */
export interface BriefingOptions {
  scenario: ScenarioId;
  tick: number;
  kind: 'situation' | 'sustainability';
  /** Refresh interval in ms. Defaults to {@link BRIEFING_REFRESH_MS}. */
  refreshMs?: number;
  /**
   * A value that, when it changes, forces an immediate refresh outside the slow
   * cadence. The dashboard passes the overall risk level, so the moment a
   * scenario escalates (elevated → critical) the AI panels re-fetch and stay
   * coherent with the live status pill instead of describing a stale, calmer
   * situation for another 20 seconds. The tick deliberately is *not* such a
   * trigger — it moves every few seconds and would empty the AI budget.
   */
  revalidateKey?: string;
}

/**
 * Fetches an AI briefing, refreshing on the briefing cadence.
 *
 * Refreshes far slower than the snapshot because each call costs AI budget.
 * The tick is read at request time rather than being a dependency, so the
 * briefing does not re-fire every time the clock advances.
 */
export function useBriefing(options: BriefingOptions): PolledResource<BriefingDto> {
  const getToken = useAuthToken();
  const { scenario, kind, revalidateKey } = options;

  // The tick moves every few seconds; capturing it as a dependency would
  // restart the poll each time and defeat the whole point of a slow cadence.
  const tickRef = useLatest(options.tick);

  const fetcher = useCallback(
    (signal: AbortSignal) =>
      apiFetch(`/api/ai/briefing`, briefingResponseSchema, getToken, {
        method: 'POST',
        body: { scenario, tick: tickRef.current, kind },
        signal,
      }),
    // revalidateKey is intentionally a dependency it does not reference: a
    // change to it must rebuild the fetcher so the poll refetches. This is the
    // standard "revalidation key" pattern; the exhaustive-deps rule cannot see
    // the intent, so it is silenced here with the reason stated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scenario, kind, getToken, tickRef, revalidateKey],
  );

  return usePolledResource(fetcher, options.refreshMs ?? BRIEFING_REFRESH_MS);
}

/**
 * Fetches ranked recommendations, refreshing on its own cadence.
 *
 * Changing `revalidateKey` forces an immediate refresh; the dashboard passes the
 * overall risk level so recommendations track escalation.
 */
export function useRecommendations(
  scenario: ScenarioId,
  tick: number,
  revalidateKey?: string,
): PolledResource<RecommendationsDto> {
  const getToken = useAuthToken();

  const tickRef = useLatest(tick);

  const fetcher = useCallback(
    (signal: AbortSignal) =>
      apiFetch(
        `/api/recommendations${query(scenario, tickRef.current)}`,
        recommendationsResponseSchema,
        getToken,
        { signal },
      ),
    // See the note in useBriefing: revalidateKey drives refetch by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scenario, getToken, tickRef, revalidateKey],
  );

  return usePolledResource(fetcher, RECOMMENDATIONS_REFRESH_MS);
}

/** The incident log plus the operations that mutate it. */
export interface IncidentsApi extends PolledResource<{ incidents: IncidentDto[] }> {
  report: (rawText: string, zoneId: string) => Promise<ApiResult<IncidentDto>>;
  preview: (rawText: string, zoneId: string) => Promise<ApiResult<TriagePreviewDto>>;
  setStatus: (id: string, status: IncidentStatus) => Promise<ApiResult<IncidentDto>>;
}

/**
 * Polls the incident log and exposes the operations that change it.
 * Scenario and tick are used as triage context.
 */
export function useIncidents(scenario: ScenarioId, tick: number): IncidentsApi {
  const getToken = useAuthToken();

  const fetcher = useCallback(
    (signal: AbortSignal) => apiFetch('/api/incidents', incidentListSchema, getToken, { signal }),
    [getToken],
  );
  const resource = usePolledResource(fetcher, INCIDENTS_POLL_MS);
  const { refresh } = resource;

  const tickRef = useLatest(tick);

  const report = useCallback(
    async (rawText: string, zoneId: string) => {
      const result = await apiFetch('/api/incidents', incidentSchema, getToken, {
        method: 'POST',
        body: { rawText, zoneId, scenario, tick: tickRef.current },
      });
      if (result.ok) refresh();
      return result;
    },
    [getToken, scenario, refresh, tickRef],
  );

  const preview = useCallback(
    (rawText: string, zoneId: string) =>
      apiFetch('/api/ai/triage', triagePreviewSchema, getToken, {
        method: 'POST',
        body: { rawText, zoneId, scenario, tick: tickRef.current },
      }),
    [getToken, scenario, tickRef],
  );

  const setStatus = useCallback(
    async (id: string, status: IncidentStatus) => {
      const result = await apiFetch(`/api/incidents/${id}`, incidentSchema, getToken, {
        method: 'PATCH',
        body: { status },
      });
      if (result.ok) refresh();
      return result;
    },
    [getToken, refresh],
  );

  return { ...resource, report, preview, setStatus };
}
