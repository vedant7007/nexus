// This badge is provenance, not a disclaimer: "rule-based" means the prose was
// written without AI, but the numbers are identical either way because the
// engine computed them in both cases. It also shows the command center keeps
// working with the AI switched off entirely.
import type { AiModeDto } from '@/lib/schemas/api';

export interface ModeBadgeProps {
  mode: AiModeDto;
}

const COPY: Record<AiModeDto, { label: string; title: string; className: string }> = {
  ai: {
    label: 'AI',
    title: 'Written by Gemini from the engine’s computed facts. The numbers are the engine’s.',
    className:
      'bg-[var(--color-accent-dim)] text-[var(--color-accent-strong)] border-[var(--color-accent)]',
  },
  rule: {
    label: 'Rule-based',
    title:
      'Written from the engine’s computed facts without AI. Same numbers, same safety decisions — only the prose differs.',
    className:
      'bg-[var(--color-surface-overlay)] text-[var(--color-ink-muted)] border-[var(--color-border-strong)]',
  },
};

/** A badge naming the source of a panel's text. */
export function ModeBadge({ mode }: ModeBadgeProps) {
  const copy = COPY[mode];

  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider ${copy.className}`}
      title={copy.title}
    >
      <span className="sr-only">Source: </span>
      {copy.label}
    </span>
  );
}
