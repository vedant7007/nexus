'use client';

/**
 * @module components/dashboard/TopBar
 *
 * Responsibility: venue identity, the hero status, and the scenario control.
 */
import { StatusPill } from '@/components/ui/StatusPill';
import type { RiskLevel } from '@/lib/engine/types';
import type { ScenarioId } from '@/lib/sim/scenarios';
import { VENUE_NAME } from '@/lib/sim/venue';

import { ScenarioPicker } from './ScenarioPicker';

/** Props for {@link TopBar}. */
export interface TopBarProps {
  overall: RiskLevel | null;
  tMinusKickoffMin: number | null;
  scenario: ScenarioId;
  onScenarioChange: (value: ScenarioId) => void;
}

/**
 * Renders the countdown to kickoff.
 *
 * @param minutes - Minutes to kickoff; negative after.
 * @returns A short label.
 */
function kickoffLabel(minutes: number): string {
  if (minutes > 0) return `T−${minutes} min`;
  if (minutes === 0) return 'Kickoff';
  return `${Math.abs(minutes)} min in`;
}

/**
 * The command center's top bar.
 *
 * @param props - Status, countdown, and scenario control.
 * @returns The bar.
 */
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

        <div aria-live="polite" className="flex items-center">
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
