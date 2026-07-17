'use client';

/**
 * @module components/dashboard/SustainabilityStrip
 *
 * Responsibility: render resource metrics and the AI insight about them.
 */
import { ModeBadge } from '@/components/ui/ModeBadge';
import { Panel, PanelSkeleton } from '@/components/ui/Panel';
import type { BriefingDto, SnapshotDto } from '@/lib/schemas/api';

/** Props for {@link SustainabilityStrip}. */
export interface SustainabilityStripProps {
  snapshot: SnapshotDto | null;
  insight: BriefingDto | null;
  loading: boolean;
}

/** A single metric and its target. */
interface Metric {
  label: string;
  value: string;
  /** Whether the metric is meeting its target, or null when it has none. */
  onTarget: boolean | null;
  detail: string;
}

/**
 * Derives the displayed metrics from a snapshot.
 *
 * Presentation only: the engine's `sustainabilitySummary` owns the analysis and
 * the AI insight already reports it. This just formats four numbers.
 *
 * @param snapshot - The venue snapshot.
 * @returns The metrics to render.
 */
function toMetrics(snapshot: SnapshotDto): Metric[] {
  const { resources } = snapshot;

  return [
    {
      label: 'Energy',
      value: `${Math.round(resources.energyKwh).toLocaleString('en-US')} kWh`,
      onTarget: null,
      detail: 'Current interval draw',
    },
    {
      label: 'Waste diverted',
      value: `${Math.round(resources.wasteDiversionPct)}%`,
      onTarget: resources.wasteDiversionPct >= 75,
      detail: 'Target 75%',
    },
    {
      label: 'Water',
      value: `${Math.round(resources.waterLitres).toLocaleString('en-US')} L`,
      onTarget: null,
      detail: 'Current interval use',
    },
    {
      label: 'Public transport',
      value: `${Math.round(resources.publicTransportSharePct)}%`,
      onTarget: resources.publicTransportSharePct >= 60,
      detail: 'Target 60% modal share',
    },
  ];
}

/**
 * Sustainability and operations metrics with an AI one-liner.
 *
 * Rendered as a definition list rather than a chart. A four-value comparison is
 * read faster as numbers than as bars, and it costs no chart library on the
 * critical path — the accessible "data table alternative" a chart would need is
 * simply the primary presentation here.
 *
 * @param props - Snapshot, insight, and loading state.
 * @returns The strip.
 */
export function SustainabilityStrip({ snapshot, insight, loading }: SustainabilityStripProps) {
  if (snapshot === null) {
    return (
      <Panel title="Sustainability & Ops">{loading ? <PanelSkeleton lines={2} /> : null}</Panel>
    );
  }

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
            <dd className="mt-0.5 text-[0.6875rem] text-[var(--color-ink-dim)]">
              {metric.detail}
              {metric.onTarget === null ? null : (
                <span
                  className={
                    metric.onTarget
                      ? 'ml-1.5 text-[var(--color-status-normal-text)]'
                      : 'ml-1.5 text-[var(--color-status-elevated-text)]'
                  }
                >
                  {metric.onTarget ? '✓ on target' : '▲ below target'}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {insight === null ? null : (
        <p
          className="mt-4 border-t border-[var(--color-border)] pt-3.5 text-sm leading-relaxed text-[var(--color-ink-muted)]"
          aria-live="polite"
        >
          {insight.text}
        </p>
      )}
    </Panel>
  );
}
