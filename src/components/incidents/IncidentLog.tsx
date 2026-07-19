'use client';

import { ModeBadge } from '@/components/ui/ModeBadge';
import { Panel, PanelEmpty, PanelError, PanelSkeleton } from '@/components/ui/Panel';
import type { IncidentStatus } from '@/lib/engine/types';
import type { IncidentDto } from '@/lib/schemas/api';
import { zoneName } from '@/lib/sim/venue';
import type { ApiError } from '@/lib/ui/apiClient';
import { INCIDENT_LOG_PAGE_SIZE } from '@/lib/ui/constants';
import { severityOf } from '@/lib/ui/status';

export interface IncidentLogProps {
  incidents: readonly IncidentDto[];
  loading: boolean;
  error: ApiError | null;
  onRetry: () => void;
  onStatusChange: (id: string, status: IncidentStatus) => void;
}

/** The status an operator can move an incident to next. */
const NEXT_STATUS: Record<IncidentStatus, IncidentStatus | null> = {
  open: 'acknowledged',
  acknowledged: 'resolved',
  resolved: null,
};

/** Button copy for advancing status. */
const ADVANCE_LABEL: Record<IncidentStatus, string> = {
  open: 'Acknowledge',
  acknowledged: 'Resolve',
  resolved: '',
};

/** Presentation for each lifecycle state. */
const STATUS_CLASS: Record<IncidentStatus, string> = {
  open: 'text-[var(--color-status-critical-text)]',
  acknowledged: 'text-[var(--color-status-elevated-text)]',
  resolved: 'text-[var(--color-status-normal-text)]',
};

/** Formats a timestamp as a wall clock time, or an em dash when unparseable. */
function toClock(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** One row of the log. */
function IncidentRow({
  incident,
  onStatusChange,
}: {
  incident: IncidentDto;
  onStatusChange: (id: string, status: IncidentStatus) => void;
}) {
  const severity = severityOf(incident.severity);
  const next = NEXT_STATUS[incident.status];

  return (
    <tr className="border-t border-[var(--color-border)]">
      <td className="px-3 py-2.5">
        <span
          className={`inline-flex items-center rounded border px-2 py-0.5 text-[0.6875rem] font-bold ${severity.badgeClass}`}
        >
          {severity.label}
        </span>
      </td>
      <td className="px-3 py-2.5 text-sm text-[var(--color-ink)]">
        <span className="block">{incident.englishText}</span>
        {incident.language !== 'unknown' && incident.language !== 'English' ? (
          <span className="mt-0.5 block text-[0.6875rem] text-[var(--color-ink-dim)]">
            {incident.language}: {incident.rawText}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2.5 text-xs text-[var(--color-ink-muted)]">
        {zoneName(incident.zoneId)}
      </td>
      <td className="px-3 py-2.5 text-xs text-[var(--color-ink-muted)]">{incident.team}</td>
      <td className="tnum px-3 py-2.5 text-xs text-[var(--color-ink-dim)]">
        {toClock(incident.createdAt)}
      </td>
      <td className="px-3 py-2.5">
        <span className={`text-xs font-semibold capitalize ${STATUS_CLASS[incident.status]}`}>
          {incident.status}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <ModeBadge mode={incident.mode} />
      </td>
      <td className="px-3 py-2.5 text-right">
        {next === null ? null : (
          <button
            type="button"
            onClick={() => onStatusChange(incident.id, next)}
            className="rounded border border-[var(--color-border-strong)] px-2.5 py-1 text-[0.6875rem] font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-surface-overlay)]"
          >
            {ADVANCE_LABEL[incident.status]}
            <span className="sr-only"> incident: {incident.englishText}</span>
          </button>
        )}
      </td>
    </tr>
  );
}

/** The live incident log, most severe first. */
export function IncidentLog({
  incidents,
  loading,
  error,
  onRetry,
  onStatusChange,
}: IncidentLogProps) {
  if (loading && incidents.length === 0) {
    return (
      <Panel title="Incident Log">
        <PanelSkeleton lines={4} />
      </Panel>
    );
  }

  if (error !== null && incidents.length === 0) {
    return (
      <Panel title="Incident Log">
        <PanelError message={error.message} onRetry={onRetry} />
      </Panel>
    );
  }

  if (incidents.length === 0) {
    return (
      <Panel title="Incident Log">
        <PanelEmpty message="No incidents logged. Reports appear here the moment they are triaged." />
      </Panel>
    );
  }

  return (
    <Panel title="Incident Log">
      {/* Wide tables must scroll inside their own container, never the page. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-left">
          <caption className="sr-only">
            Incidents, most severe first. Severity and responding team are decided by rule, not by
            AI.
          </caption>
          <thead>
            <tr className="text-[0.6875rem] uppercase tracking-wider text-[var(--color-ink-dim)]">
              <th scope="col" className="px-3 pb-2 font-semibold">
                Severity
              </th>
              <th scope="col" className="px-3 pb-2 font-semibold">
                Report
              </th>
              <th scope="col" className="px-3 pb-2 font-semibold">
                Zone
              </th>
              <th scope="col" className="px-3 pb-2 font-semibold">
                Team
              </th>
              <th scope="col" className="px-3 pb-2 font-semibold">
                Time
              </th>
              <th scope="col" className="px-3 pb-2 font-semibold">
                Status
              </th>
              <th scope="col" className="px-3 pb-2 font-semibold">
                Triage
              </th>
              <th scope="col" className="px-3 pb-2 text-right font-semibold">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {incidents.slice(0, INCIDENT_LOG_PAGE_SIZE).map((incident) => (
              <IncidentRow key={incident.id} incident={incident} onStatusChange={onStatusChange} />
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
