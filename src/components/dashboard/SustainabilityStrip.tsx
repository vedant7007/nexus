'use client';

import { ModeBadge } from '@/components/ui/ModeBadge';
import { Panel } from '@/components/ui/Panel';
import type { BriefingDto, SnapshotDto } from '@/lib/schemas/api';

export interface SustainabilityStripProps {
  snapshot: SnapshotDto | null;
  insight: BriefingDto | null;
}

/** A single metric and its target. */
interface Metric {
  label: string;
  value: string;
  /** Whether the metric is meeting its target, or null when it has none. */
  onTarget: boolean | null;
  detail: string;
}

/** Placeholder for a value that has not arrived yet. */
const PENDING = '—';

/** Static definition of each metric, so labels render before any data. */
const METRIC_DEFS: readonly { label: string; detail: string }[] = [
  { label: 'Energy', detail: 'Current interval draw' },
  { label: 'Waste diverted', detail: 'Target 75%' },
  { label: 'Water', detail: 'Current interval use' },
  { label: 'Public transport', detail: 'Target 60% modal share' },
];

/**
 * Derives the displayed metrics from a snapshot, or placeholders when it has not
 * arrived. Always returns the same four rows in the same order, so the panel's
 * height is fixed whether or not data is present — no layout shift.
 *
 * Presentation only: the engine's `sustainabilitySummary` owns the analysis and
 * the AI insight already reports it. This just formats four numbers.
 */
function toMetrics(snapshot: SnapshotDto | null): Metric[] {
  const r = snapshot?.resources;
  const values: { value: string; onTarget: boolean | null }[] =
    r === undefined
      ? METRIC_DEFS.map(() => ({ value: PENDING, onTarget: null }))
      : [
          { value: `${Math.round(r.energyKwh).toLocaleString('en-US')} kWh`, onTarget: null },
          { value: `${Math.round(r.wasteDiversionPct)}%`, onTarget: r.wasteDiversionPct >= 75 },
          { value: `${Math.round(r.waterLitres).toLocaleString('en-US')} L`, onTarget: null },
          {
            value: `${Math.round(r.publicTransportSharePct)}%`,
            onTarget: r.publicTransportSharePct >= 60,
          },
        ];

  return METRIC_DEFS.map((def, i) => ({
    label: def.label,
    detail: def.detail,
    value: values[i]?.value ?? PENDING,
    onTarget: values[i]?.onTarget ?? null,
  }));
}

/**
 * Sustainability and operations metrics with an AI one-liner.
 *
 * Rendered as a definition list rather than a chart. A four-value comparison is
 * read faster as numbers than as bars, and it costs no chart library on the
 * critical path — the accessible "data table alternative" a chart would need is
 * simply the primary presentation here.
 */
export function SustainabilityStrip({ snapshot, insight }: SustainabilityStripProps) {
  return (
    <Panel
      title="Sustainability & Ops"
      actions={insight === null ? null : <ModeBadge mode={insight.mode} />}
    >
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {toMetrics(snapshot).map((metric) => (
          <div key={metric.label}>
            <dt className="text-[0.6875rem] uppercase tracking-wider text-[var(--color-ink-dim)]">
              {metric.label}
            </dt>
            <dd className="tnum mt-1 text-xl font-bold text-[var(--color-ink)]">{metric.value}</dd>
            <dd className="mt-0.5 text-[0.6875rem] text-[var(--color-ink-dim)]">{metric.detail}</dd>
            {/* The target status sits on its own line so it never wraps
                awkwardly under the detail text on a narrow column. */}
            {metric.onTarget === null ? null : (
              <dd
                className={`mt-0.5 text-[0.6875rem] font-medium ${
                  metric.onTarget
                    ? 'text-[var(--color-status-normal-text)]'
                    : 'text-[var(--color-status-elevated-text)]'
                }`}
              >
                {metric.onTarget ? '✓ on target' : '▲ below target'}
              </dd>
            )}
          </div>
        ))}
      </dl>

      {/* The insight line is always present (min-height reserved) so its
          arrival swaps text rather than pushing the panel taller. */}
      <p
        className="mt-4 min-h-[2.5rem] border-t border-[var(--color-border)] pt-3.5 text-sm leading-relaxed text-[var(--color-ink-muted)]"
        aria-live="polite"
      >
        {insight === null ? 'Computing resource insight…' : insight.text}
      </p>
    </Panel>
  );
}
