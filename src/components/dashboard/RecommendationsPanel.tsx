'use client';

import { memo } from 'react';

import { ModeBadge } from '@/components/ui/ModeBadge';
import { Panel, PanelEmpty, PanelError, PanelSkeleton } from '@/components/ui/Panel';
import { StatusPill } from '@/components/ui/StatusPill';
import type { RecommendationDto, RecommendationsDto } from '@/lib/schemas/api';
import type { ApiError } from '@/lib/ui/apiClient';
import { MAX_VISIBLE_RECOMMENDATIONS } from '@/lib/ui/constants';

export interface RecommendationsPanelProps {
  recommendations: RecommendationsDto | null;
  loading: boolean;
  error: ApiError | null;
  onRetry: () => void;
  onAcknowledge: (riskId: string) => void;
  /** Risk ids already acknowledged this session. */
  acknowledged: ReadonlySet<string>;
}

interface RecommendationCardProps {
  recommendation: RecommendationDto;
  acknowledged: boolean;
  onAcknowledge: (riskId: string) => void;
}

/**
 * One recommendation.
 *
 * The impact is given its own visually prominent block rather than being buried
 * in the reasoning paragraph. That is the whole product in one element: the
 * engine computed "122% → 85.4%", the model only explained it, and the operator
 * should be able to see the number without reading the prose.
 */
function RecommendationCard({
  recommendation,
  acknowledged,
  onAcknowledge,
}: RecommendationCardProps) {
  const { riskId, subjectName, level, action, impact, reasoning } = recommendation;

  return (
    <li className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <StatusPill level={level} />
        <span className="text-sm font-semibold text-[var(--color-ink)]">{subjectName}</span>
      </div>

      <p className="text-[0.9375rem] font-semibold leading-snug text-[var(--color-ink)]">
        {action}
      </p>

      <div className="mt-3 rounded-md border-l-2 border-[var(--color-accent)] bg-[var(--color-void)] px-3 py-2.5">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
          Computed impact
        </p>
        <p className="tnum mt-1 text-sm leading-relaxed text-[var(--color-ink)]">{impact}</p>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">{reasoning}</p>

      <button
        type="button"
        onClick={() => onAcknowledge(riskId)}
        disabled={acknowledged}
        className="mt-3.5 rounded-md border border-[var(--color-border-strong)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-surface-overlay)] disabled:cursor-default disabled:border-[var(--color-status-normal)] disabled:text-[var(--color-status-normal-text)]"
      >
        {acknowledged ? '✓ Acknowledged' : 'Acknowledge'}
      </button>
    </li>
  );
}

/** The AI decision recommendations panel. */
function RecommendationsPanelImpl({
  recommendations,
  loading,
  error,
  onRetry,
  onAcknowledge,
  acknowledged,
}: RecommendationsPanelProps) {
  const items = recommendations?.items.slice(0, MAX_VISIBLE_RECOMMENDATIONS) ?? [];

  return (
    <Panel
      title="AI Recommendations"
      actions={recommendations === null ? null : <ModeBadge mode={recommendations.mode} />}
    >
      {/* Reserve vertical space so the transition from skeleton to cards does
          not push the sustainability strip below it around — a cumulative
          layout shift the dashboard was losing performance points to. */}
      <div aria-live="polite" aria-busy={loading} className="min-h-[13rem]">
        {loading && recommendations === null ? <PanelSkeleton lines={5} /> : null}

        {recommendations === null && error !== null ? (
          <PanelError message={error.message} onRetry={onRetry} />
        ) : null}

        {recommendations !== null && items.length === 0 ? (
          <PanelEmpty message="No action needed. Every zone, gate and transit line is within threshold." />
        ) : null}

        {items.length > 0 ? (
          <ul className="space-y-3">
            {items.map((item) => (
              <RecommendationCard
                key={item.riskId}
                recommendation={item}
                acknowledged={acknowledged.has(item.riskId)}
                onAcknowledge={onAcknowledge}
              />
            ))}
          </ul>
        ) : null}
      </div>
    </Panel>
  );
}

/**
 * The AI decision recommendations panel.
 *
 * Memoised for the same reason as the briefing: recommendations refresh on a
 * slow cadence, so they need not re-render on every dashboard clock tick.
 */
export const RecommendationsPanel = memo(RecommendationsPanelImpl);
