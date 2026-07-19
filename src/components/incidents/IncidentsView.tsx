'use client';

import { useCallback, useState } from 'react';

import { NavBar } from '@/components/NavBar';
import { Panel } from '@/components/ui/Panel';
import type { IncidentStatus } from '@/lib/engine/types';
import type { TriagePreviewDto } from '@/lib/schemas/api';
import type { ApiError } from '@/lib/ui/apiClient';
import { useIncidents } from '@/lib/ui/hooks';
import { useSimClock } from '@/lib/ui/useSimClock';

import { IncidentLog } from './IncidentLog';
import { ReportForm } from './ReportForm';
import { TriageResult } from './TriageResult';

/** The multilingual incident copilot. */
export function IncidentsView() {
  const { tick } = useSimClock();
  const incidents = useIncidents('normal', tick);

  const [preview, setPreview] = useState<TriagePreviewDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const handlePreview = useCallback(
    async (rawText: string, zoneId: string) => {
      setBusy(true);
      setError(null);
      const result = await incidents.preview(rawText, zoneId);
      if (result.ok) setPreview(result.value);
      else setError(result.error);
      setBusy(false);
    },
    [incidents],
  );

  const handleSubmit = useCallback(
    async (rawText: string, zoneId: string) => {
      setBusy(true);
      setError(null);
      const result = await incidents.report(rawText, zoneId);
      if (result.ok) setPreview(null);
      else setError(result.error);
      setBusy(false);
    },
    [incidents],
  );

  const handleStatusChange = useCallback(
    (id: string, status: IncidentStatus) => {
      void incidents.setStatus(id, status);
    },
    [incidents],
  );

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-[100rem] px-5 py-3.5">
          <h1 className="text-base font-bold tracking-tight">Incident Copilot</h1>
        </div>
      </header>
      <NavBar />

      <main id="main" className="mx-auto max-w-[100rem] space-y-4 px-5 py-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="New Report">
            <ReportForm
              onPreview={handlePreview}
              onSubmit={handleSubmit}
              busy={busy}
              error={error}
              preview={preview}
            />
          </Panel>

          <div>
            {preview === null ? (
              <Panel title="Triage">
                <p className="py-8 text-center text-sm text-[var(--color-ink-dim)]">
                  Submit a report to see the detected language, translation, and the rule-based
                  severity and routing.
                </p>
              </Panel>
            ) : (
              <TriageResult result={preview} />
            )}
          </div>
        </div>

        <IncidentLog
          incidents={incidents.data?.incidents ?? []}
          loading={incidents.loading}
          error={incidents.error}
          onRetry={incidents.refresh}
          onStatusChange={handleStatusChange}
        />
      </main>
    </>
  );
}
