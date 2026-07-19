'use client';

import { StatusPill } from '@/components/ui/StatusPill';
import type { RiskLevel } from '@/lib/engine/types';
import type { ScenarioId } from '@/lib/sim/scenarios';
import { VENUE_NAME } from '@/lib/sim/venue';

import { ScenarioPicker } from './ScenarioPicker';

export interface TopBarProps {
  overall: RiskLevel | null;
  tMinusKickoffMin: number | null;
  scenario: ScenarioId;
  onScenarioChange: (value: ScenarioId) => void;
}

/** Renders the countdown to kickoff. */
function kickoffLabel(minutes: number): string {
  if (minutes > 0) return `T−${minutes} min`;
  if (minutes === 0) return 'Kickoff';
  return `${Math.abs(minutes)} min in`;
}

/** The command center's top bar. */
export function TopBar({ overall, tMinusKickoffMin, scenario, onScenarioChange }: TopBarProps) {
  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-[100rem] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3.5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-bold tracking-tight text-[var(--color-ink)]">NEXUS</h1>
          <span className="text-xs text-[var(--color-ink-dim)]">{VENUE_NAME}</span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--color-ink-dim)]">Kickoff</span>
          <span className="tnum font-semibold text-[var(--color-ink)]">
            {tMinusKickoffMin === null ? '—' : kickoffLabel(tMinusKickoffMin)}
          </span>
        </div>

        {/* Fixed footprint — height AND width. Swapping the placeholder for the
            status pill (taller, and wider at "Critical") would otherwise reflow
            this wrapping flex header and push the whole dashboard down. Pinning
            the slot's size makes that the page's zero-shift moment. */}
        <div aria-live="polite" className="flex h-10 w-[12rem] items-center">
          {overall === null ? (
            <span className="text-xs text-[var(--color-ink-dim)]">Assessing…</span>
          ) : (
            <StatusPill level={overall} size="lg" prefix="Overall:" />
          )}
        </div>

        <div className="ms-auto">
          <ScenarioPicker value={scenario} onChange={onScenarioChange} />
        </div>
      </div>
    </header>
  );
}
