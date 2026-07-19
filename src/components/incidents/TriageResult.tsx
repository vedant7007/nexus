'use client';

// The visual split here is the argument. Translation and category sit in one
// block labelled as AI understanding; severity and routing sit in another,
// labelled rule-based, with the rule that fired quoted underneath. An operator
// should be able to see at a glance that the thing which decided "SEV-1" was
// not the thing that guessed the language.
import { ModeBadge } from '@/components/ui/ModeBadge';
import type { TriagePreviewDto } from '@/lib/schemas/api';
import { severityOf } from '@/lib/ui/status';

export interface TriageResultProps {
  result: TriagePreviewDto;
}

/** Human labels for incident categories. */
const TYPE_LABEL: Record<string, string> = {
  medical: 'Medical',
  crowd: 'Crowd',
  security: 'Security',
  facilities: 'Facilities',
  lost_person: 'Lost person',
  transport: 'Transport',
};

/** The triage outcome for a report. */
export function TriageResult({ result }: TriageResultProps) {
  const severity = severityOf(result.severity);

  return (
    <div className="space-y-3" aria-live="polite">
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-dim)]">
            Understanding
          </h3>
          <ModeBadge mode={result.mode} />
        </div>

        <dl className="space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-[var(--color-ink-dim)]">Language</dt>
            <dd className="text-[var(--color-ink)]">{result.detectedLanguage}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-[var(--color-ink-dim)]">English</dt>
            <dd className="text-[var(--color-ink)]">{result.englishText}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-[var(--color-ink-dim)]">Category</dt>
            <dd className="text-[var(--color-ink)]">{TYPE_LABEL[result.type] ?? result.type}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] p-4">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-dim)]">
            Triage decision
          </h3>
          <span className="inline-flex items-center rounded border border-[var(--color-border-strong)] bg-[var(--color-surface-overlay)] px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
            Rule-based · not AI
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold ${severity.badgeClass}`}
          >
            {severity.label}
          </span>
          <span className="text-sm text-[var(--color-ink-muted)]">{severity.meaning}</span>
        </div>

        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-[var(--color-ink-dim)]">Responding</dt>
            <dd className="font-medium text-[var(--color-ink)]">{result.team}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-[var(--color-ink-dim)]">Rule fired</dt>
            <dd className="font-mono text-[0.75rem] text-[var(--color-ink-muted)]">
              {result.matchedRule}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4">
        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-dim)]">
          Response protocol
        </h3>
        <ol className="list-inside list-decimal space-y-1.5 text-sm text-[var(--color-ink)]">
          {result.protocol.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
