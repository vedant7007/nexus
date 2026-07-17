'use client';

/**
 * @module components/dashboard/ZoneGrid
 *
 * Responsibility: render live zone density and gate load. Presentational only.
 */
import { Panel, PanelSkeleton } from '@/components/ui/Panel';
import { formatCount } from '@/lib/engine/situation';
import { classifyGateUtilization } from '@/lib/engine/thresholds';
import { ZONE_TILE_FULL_PCT } from '@/lib/ui/constants';
import type { GateStateDto, ZoneStateDto } from '@/lib/ui/dto';
import { densityBand, statusOf } from '@/lib/ui/status';

/** Props for {@link ZoneGrid}. */
export interface ZoneGridProps {
  zones: readonly ZoneStateDto[];
  gates: readonly GateStateDto[];
  loading: boolean;
}

/**
 * One zone tile.
 *
 * @param props - The zone to render.
 * @returns The tile.
 */
function ZoneTile({ zone }: { zone: ZoneStateDto }) {
  const level = densityBand(zone.densityPct);
  const status = statusOf(level);
  const barWidth = Math.min(ZONE_TILE_FULL_PCT, zone.densityPct);

  return (
    <li className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-medium text-[var(--color-ink-muted)]">
          {zone.name}
        </span>
        <span className={`tnum text-sm font-bold ${status.textClass}`}>
          {Math.round(zone.densityPct)}%
        </span>
      </div>

      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-overlay)]"
        role="presentation"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${status.fillClass}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      <p className="mt-1.5 flex items-center gap-1 text-[0.6875rem] text-[var(--color-ink-dim)]">
        {/* The label is what makes this readable without colour vision. */}
        <span className={status.textClass} aria-hidden="true">
          {status.icon}
        </span>
        <span className={status.textClass}>{status.label}</span>
        <span aria-hidden="true">·</span>
        <span className="tnum">{formatCount(zone.occupancy)}</span>
      </p>
    </li>
  );
}

/**
 * One gate row.
 *
 * @param props - The gate to render.
 * @returns The row.
 */
function GateRow({ gate }: { gate: GateStateDto }) {
  const status = statusOf(classifyGateUtilization(gate.utilizationPct));

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2.5">
      <span className="text-xs font-medium text-[var(--color-ink-muted)]">{gate.name}</span>
      <span className="flex items-center gap-3 text-[0.6875rem]">
        <span className="text-[var(--color-ink-dim)]">
          queue <span className="tnum text-[var(--color-ink)]">{formatCount(gate.queueLen)}</span>
        </span>
        <span className={`tnum font-semibold ${status.textClass}`}>
          {Math.round(gate.utilizationPct)}%
        </span>
        <span className={`${status.textClass} w-14 text-right`}>{status.label}</span>
      </span>
    </li>
  );
}

/**
 * The live zone and gate readout.
 *
 * @param props - Zones, gates, and loading state.
 * @returns The panel.
 */
export function ZoneGrid({ zones, gates, loading }: ZoneGridProps) {
  if (loading && zones.length === 0) {
    return (
      <Panel title="Zones & Gates">
        <PanelSkeleton lines={6} />
      </Panel>
    );
  }

  return (
    <Panel title="Zones & Gates">
      <h3 className="sr-only">Zone density</h3>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {zones.map((zone) => (
          <ZoneTile key={zone.id} zone={zone} />
        ))}
      </ul>

      <h3 className="mt-5 mb-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-dim)]">
        Gates
      </h3>
      <ul className="space-y-2">
        {gates.map((gate) => (
          <GateRow key={gate.id} gate={gate} />
        ))}
      </ul>
    </Panel>
  );
}
