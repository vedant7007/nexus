import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/30">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden="true" className="text-[var(--color-status-normal)]">
            ●
          </span>
          NEXUS
          <span className="font-normal text-[var(--color-ink-dim)]">· Meridian Stadium</span>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--color-ink-dim)]">
          <Link href="/dashboard" className="transition-colors hover:text-[var(--color-ink)]">
            Command center
          </Link>
          <Link href="/incidents" className="transition-colors hover:text-[var(--color-ink)]">
            Incidents
          </Link>
          <Link href="/methodology" className="transition-colors hover:text-[var(--color-ink)]">
            Methodology
          </Link>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-6 pb-8 text-xs text-[var(--color-ink-dim)]">
        FIFA World Cup 2026 operations demo · GenAI-central, safety-deterministic. Venue, feeds and
        scenarios are simulated.
      </p>
    </footer>
  );
}
