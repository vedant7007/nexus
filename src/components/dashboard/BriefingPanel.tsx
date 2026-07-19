'use client';

import { memo } from 'react';

import { ModeBadge } from '@/components/ui/ModeBadge';
import { Panel, PanelError, PanelSkeleton } from '@/components/ui/Panel';
import type { BriefingDto } from '@/lib/schemas/api';
import type { ApiError } from '@/lib/ui/apiClient';

export interface BriefingPanelProps {
  briefing: BriefingDto | null;
  loading: boolean;
  error: ApiError | null;
  onRetry: () => void;
}

/** Formats an ISO timestamp as a wall-clock time, or empty when unparseable. */
function toClockTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * The AI situational briefing panel.
 *
 * The region is `aria-live="polite"` rather than `assertive`: this text updates
 * on a timer, and an assertive region would interrupt a screen reader user
 * mid-sentence every refresh. Polite queues the update until they are idle.
 *
 * Memoised: the dashboard clock re-renders its parent every few seconds, but a
 * briefing only changes on its own slow cadence, so skipping the intervening
 * renders is a real reduction in main-thread work on a constrained device.
 */
function BriefingPanelImpl({ briefing, loading, error, onRetry }: BriefingPanelProps) {
  const showError = briefing === null && error !== null;

  return (
    <Panel
      title="AI Situational Briefing"
      actions={
        briefing === null ? null : (
          <>
            <ModeBadge mode={briefing.mode} />
            <span className="tnum text-[0.6875rem] text-[var(--color-ink-dim)]">
              {toClockTime(briefing.generatedAt)}
            </span>
          </>
        )
      }
    >
      {/* Tall enough to hold the longest (critical) briefing, so the panel does
          not grow as the situation escalates mid-session — a layout shift. */}
      <div aria-live="polite" aria-busy={loading} className="min-h-[9.5rem]">
        {loading && briefing === null ? <PanelSkeleton lines={4} /> : null}

        {showError ? (
          <PanelError message={error.message} onRetry={onRetry} />
        ) : briefing === null ? null : (
          <p className="text-[0.9375rem] leading-relaxed text-[var(--color-ink)]">
            {briefing.text}
          </p>
        )}
      </div>
    </Panel>
  );
}

/** The AI situational briefing panel. */
export const BriefingPanel = memo(BriefingPanelImpl);
