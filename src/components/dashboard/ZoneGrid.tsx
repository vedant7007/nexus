'use client';

// The venue's 8 zones and 6 gates are static, known at build time. So the grid
// always renders that full structure — every tile and row, by name — and fills
// in live values as they arrive. It never swaps a short skeleton for a taller
// populated grid, which means the panel's height is fixed from first paint and
// contributes no layout shift. A placeholder dash reads as "measuring", not as a
// broken value.
import { Panel } from '@/components/ui/Panel';
import { formatCount } from '@/lib/engine/situation';
import { classifyGateUtilization } from '@/lib/engine/thresholds';
import { GATES, ZONES } from '@/lib/sim/venue';
import { ZONE_TILE_FULL_PCT } from '@/lib/ui/constants';
import type { GateStateDto, ZoneStateDto } from '@/lib/ui/dto';
import { densityBand, statusOf } from '@/lib/ui/status';

export interface ZoneGridProps {
  zones: readonly ZoneStateDto[];
  gates: readonly GateStateDto[];
  loading: boolean;
}

/** Placeholder shown for a value that has not arrived yet. */
const PENDING = '—';

/**
 * One zone tile. Renders live values when present, placeholders otherwise, at a
 * fixed height either way.
 */
function ZoneTile({ name, zone }: { name: string; zone: ZoneStateDto | undefined }) {
  const status = statusOf(densityBand(zone?.densityPct ?? 0));
  const barWidth = zone === undefined ? 0 : Math.min(ZONE_TILE_FULL_PCT, zone.densityPct);

  return (
    <li className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3">
      {/* items-start + a reserved two-line name box: long names ("East
          Concourse") wrap in full instead of truncating, and the fixed height
          keeps every tile the same size so the grid rows stay aligned. */}
      <div className="flex min-h-[2.25rem] items-start justify-between gap-2">
        <span className="text-xs font-medium leading-tight text-[var(--color-ink-muted)]">
          {name}
        </span>
        <span
          className={`tnum shrink-0 text-sm font-bold ${zone === undefined ? 'text-[var(--color-ink-dim)]' : status.textClass}`}
        >
          {zone === undefined ? PENDING : `${Math.round(zone.densityPct)}%`}
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
        {zone === undefined ? (
          <span>Measuring…</span>
        ) : (
          <>
            {/* The label is what makes this readable without colour vision. */}
            <span className={status.textClass} aria-hidden="true">
              {status.icon}
            </span>
            <span className={status.textClass}>{status.label}</span>
            <span aria-hidden="true">·</span>
            <span className="tnum">{formatCount(zone.occupancy)}</span>
          </>
        )}
      </p>
    </li>
  );
}

/** One gate row, live or pending, at a fixed height. */
function GateRow({ name, gate }: { name: string; gate: GateStateDto | undefined }) {
  const status = statusOf(classifyGateUtilization(gate?.utilizationPct ?? 0));

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2.5">
      <span className="text-xs font-medium text-[var(--color-ink-muted)]">{name}</span>
      {gate === undefined ? (
        <span className="text-[0.6875rem] text-[var(--color-ink-dim)]">Measuring…</span>
      ) : (
        <span className="flex items-center gap-3 text-[0.6875rem]">
          <span className="text-[var(--color-ink-dim)]">
            queue <span className="tnum text-[var(--color-ink)]">{formatCount(gate.queueLen)}</span>
          </span>
          <span className={`tnum font-semibold ${status.textClass}`}>
            {Math.round(gate.utilizationPct)}%
          </span>
          <span className={`${status.textClass} w-14 text-right`}>{status.label}</span>
        </span>
      )}
    </li>
  );
}

/**
 * The live zone and gate readout.
 *
 * `loading` is accepted for API symmetry with the other panels but is not
 * needed: the static structure renders regardless.
 */
export function ZoneGrid({ zones, gates }: ZoneGridProps) {
  const zoneById = new Map(zones.map((z) => [z.id, z]));
  const gateById = new Map(gates.map((g) => [g.id, g]));

  return (
    <Panel title="Zones & Gates">
      <h3 className="sr-only">Zone density</h3>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {ZONES.map((zone) => (
          <ZoneTile key={zone.id} name={zone.name} zone={zoneById.get(zone.id)} />
        ))}
      </ul>

      <h3 className="mt-5 mb-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-dim)]">
        Gates
      </h3>
      <ul className="space-y-2">
        {GATES.map((gate) => (
          <GateRow key={gate.id} name={gate.name} gate={gateById.get(gate.id)} />
        ))}
      </ul>
    </Panel>
  );
}
