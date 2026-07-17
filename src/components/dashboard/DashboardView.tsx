'use client';

/**
 * @module components/dashboard/DashboardView
 *
 * Responsibility: wire the data hooks to the presentational panels.
 *
 * This is the only stateful component on the dashboard. It owns the scenario
 * selection, the clock, and the acknowledged set, and hands everything else
 * down as props — which is what keeps every panel below it a pure function of
 * its inputs and testable without a network.
 */
import { useCallback, useState } from 'react';

import { NavBar } from '@/components/NavBar';
import type { ScenarioId } from '@/lib/sim/scenarios';
import { useBriefing, useRecommendations, useSituation, useSnapshot } from '@/lib/ui/hooks';
import { useSimClock } from '@/lib/ui/useSimClock';

import { BriefingPanel } from './BriefingPanel';
import { RecommendationsPanel } from './RecommendationsPanel';
import { StadiumMap } from './StadiumMap';
import { SustainabilityStrip } from './SustainabilityStrip';
import { TopBar } from './TopBar';
import { ZoneGrid } from './ZoneGrid';

/**
 * The command center.
 *
 * @returns The dashboard.
 */
export function DashboardView() {
  const [scenario, setScenario] = useState<ScenarioId>('normal');
  const [acknowledged, setAcknowledged] = useState<ReadonlySet<string>>(new Set());
  const { tick } = useSimClock();

  const snapshot = useSnapshot(scenario, tick);
  const situation = useSituation(scenario, tick);
  const briefing = useBriefing({ scenario, tick, kind: 'situation' });
  const sustainability = useBriefing({ scenario, tick, kind: 'sustainability' });
  const recommendations = useRecommendations(scenario, tick);

  const handleScenarioChange = useCallback((next: ScenarioId) => {
    setScenario(next);
    // Acknowledgements belong to the situation that produced them; carrying
    // them into a different scenario would silently suppress new advice.
    setAcknowledged(new Set());
  }, []);

  const handleAcknowledge = useCallback((riskId: string) => {
    setAcknowledged((prev) => new Set(prev).add(riskId));
  }, []);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <TopBar
        overall={situation.data?.overall ?? null}
        tMinusKickoffMin={snapshot.data?.tMinusKickoffMin ?? null}
        scenario={scenario}
        onScenarioChange={handleScenarioChange}
      />
      <NavBar />

      <main id="main" className="mx-auto max-w-[100rem] px-5 py-5">
        <h2 className="sr-only">Live operations overview</h2>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
          <div className="space-y-4">
            <StadiumMap zones={snapshot.data?.zones ?? []} />
            <ZoneGrid
              zones={snapshot.data?.zones ?? []}
              gates={snapshot.data?.gates ?? []}
              loading={snapshot.loading}
            />
          </div>

          <div className="space-y-4">
            <BriefingPanel
              briefing={briefing.data}
              loading={briefing.loading}
              error={briefing.error}
              onRetry={briefing.refresh}
            />
            <RecommendationsPanel
              recommendations={recommendations.data}
              loading={recommendations.loading}
              error={recommendations.error}
              onRetry={recommendations.refresh}
              onAcknowledge={handleAcknowledge}
              acknowledged={acknowledged}
            />
          </div>
        </div>

        <div className="mt-4">
          <SustainabilityStrip
            snapshot={snapshot.data}
            insight={sustainability.data}
            loading={sustainability.loading}
          />
        </div>
      </main>
    </>
  );
}
