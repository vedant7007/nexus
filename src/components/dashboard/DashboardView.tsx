'use client';

// The only stateful component on the dashboard: it owns the scenario selection,
// the clock, and the acknowledged set, and hands everything else down as props —
// which is what keeps every panel below it a pure function of its inputs and
// testable without a network.
import { useCallback, useState } from 'react';

import { NavBar } from '@/components/NavBar';
import type { ScenarioId } from '@/lib/sim/scenarios';
import { LEVEL_SETTLE_MS, SUSTAINABILITY_REFRESH_MS } from '@/lib/ui/constants';
import { useBriefing, useRecommendations, useSituation, useSnapshot } from '@/lib/ui/hooks';
import { useDebouncedValue } from '@/lib/ui/useDebouncedValue';
import { useEscalation } from '@/lib/ui/useEscalation';
import { useSimClock } from '@/lib/ui/useSimClock';

import { BriefingPanel } from './BriefingPanel';
import { EscalationFlash } from './EscalationFlash';
import { RecommendationsPanel } from './RecommendationsPanel';
import { StadiumMap } from './StadiumMap';
import { SustainabilityStrip } from './SustainabilityStrip';
import { TopBar } from './TopBar';
import { ZoneGrid } from './ZoneGrid';

/** The command center. */
export function DashboardView() {
  const [scenario, setScenario] = useState<ScenarioId>('normal');
  const [acknowledged, setAcknowledged] = useState<ReadonlySet<string>>(new Set());
  const { tick } = useSimClock();

  const snapshot = useSnapshot(scenario, tick);
  const situation = useSituation(scenario, tick);

  // Keep the AI panels coherent with the live status: when the overall level
  // changes, re-fetch them immediately rather than waiting out their slow
  // cadence. This is what makes the escalation read as one coordinated moment.
  const level = situation.data?.overall;
  // Debounced level drives the costly AI refetch, so band-boundary jitter cannot
  // flap it and burn quota; the live status pill below uses the raw level.
  const settledLevel = useDebouncedValue(level, LEVEL_SETTLE_MS);
  const briefing = useBriefing({ scenario, tick, kind: 'situation', revalidateKey: settledLevel });
  const sustainability = useBriefing({
    scenario,
    tick,
    kind: 'sustainability',
    refreshMs: SUSTAINABILITY_REFRESH_MS,
  });
  const recommendations = useRecommendations(scenario, tick, settledLevel);

  const overall = level ?? null;
  // The flash fires on the settled level, so it marks a real escalation
  // alongside the AI refresh rather than flickering on boundary jitter.
  const escalationToken = useEscalation(settledLevel ?? null);

  // Hoisted once so the JSX below stays branch-light (and each fallback is
  // evaluated a single time per render, not per use).
  const zones = snapshot.data?.zones ?? [];
  const gates = snapshot.data?.gates ?? [];
  const tMinusKickoffMin = snapshot.data?.tMinusKickoffMin ?? null;

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
        overall={overall}
        tMinusKickoffMin={tMinusKickoffMin}
        scenario={scenario}
        onScenarioChange={handleScenarioChange}
      />
      <NavBar />

      <main id="main" className="mx-auto max-w-[100rem] px-5 py-5">
        <h2 className="sr-only">Live operations overview</h2>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
          <div className="space-y-4">
            <StadiumMap zones={zones} />
            <ZoneGrid zones={zones} gates={gates} loading={snapshot.loading} />
          </div>

          <div className="space-y-4">
            <EscalationFlash token={escalationToken}>
              <BriefingPanel
                briefing={briefing.data}
                loading={briefing.loading}
                error={briefing.error}
                onRetry={briefing.refresh}
              />
            </EscalationFlash>
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
          <SustainabilityStrip snapshot={snapshot.data} insight={sustainability.data} />
        </div>
      </main>
    </>
  );
}
