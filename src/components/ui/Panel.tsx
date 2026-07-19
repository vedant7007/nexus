// Centralising the loading / empty / error states here makes "no
// spinner-forever, no blank div" a property of the system rather than a promise
// each panel has to keep on its own.
export interface PanelProps {
  title: string;
  /** Rendered at the top-right: mode badges, timestamps, controls. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Heading level, so each page keeps a sane outline under its single h1. */
  headingLevel?: 2 | 3;
}

/** A titled panel. */
export function Panel({ title, actions, children, className = '', headingLevel = 2 }: PanelProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  return (
    <section className={`panel flex flex-col p-5 ${className}`} aria-labelledby={toId(title)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <Heading
          id={toId(title)}
          className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-muted)]"
        >
          {title}
        </Heading>
        {actions === undefined ? null : (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
      {children}
    </section>
  );
}

/** Derives a stable DOM id from a panel title. */
function toId(title: string): string {
  return `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

/**
 * Skeleton shown before a panel's first data arrives.
 *
 * Mirrors the shape of the real content rather than spinning, so the layout
 * does not jump when data lands — a spinner that becomes three lines of text is
 * a cumulative layout shift with extra steps.
 */
export function PanelSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2.5" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="h-3.5 animate-pulse rounded bg-[var(--color-surface-overlay)]"
          style={{ width: `${100 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

/** Error state with a retry affordance. */
export function PanelError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-[var(--color-status-critical)] bg-[var(--color-status-critical-bg)] p-4">
      <p className="text-sm text-[var(--color-status-critical-text)]">{message}</p>
      {onRetry === undefined ? null : (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded border border-[var(--color-border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-surface-overlay)]"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/** Empty state. */
export function PanelEmpty({ message }: { message: string }) {
  return <p className="py-6 text-center text-sm text-[var(--color-ink-dim)]">{message}</p>;
}
