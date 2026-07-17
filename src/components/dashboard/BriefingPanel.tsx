'use client';

/**
 * @module components/dashboard/BriefingPanel
 *
 * Responsibility: render the situational briefing. Presentational only.
 */
import { ModeBadge } from '@/components/ui/ModeBadge';
import { Panel, PanelError, PanelSkeleton } from '@/components/ui/Panel';
import type { BriefingDto } from '@/lib/schemas/api';
import type { ApiError } from '@/lib/ui/apiClient';

/** Props for {@link BriefingPanel}. */
export interface BriefingPanelProps {
  briefing: BriefingDto | null;
  loading: boolean;
  error: ApiError | null;
  onRetry: () => void;
}

/**
 * Formats an ISO timestamp as a wall-clock time.
 *
 * @param iso - ISO-8601 timestamp.
 * @returns A local time string, or an empty string when unparseable.
 */
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
 * @param props - The briefing, its states, and a retry callback.
 * @returns The panel.
 */
export function BriefingPanel({ briefing, loading, error, onRetry }: BriefingPanelProps) {
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
      <div aria-live="polite" aria-busy={loading} className="min-h-[7rem]">
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
