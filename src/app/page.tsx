import Link from 'next/link';

/**
 * Public landing page.
 *
 * Deliberately free of Firebase and chart imports: this is the page Lighthouse
 * scores on mobile, so it must stay on the critical-path budget.
 */
export default function HomePage() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      {/* Top / hero / bottom anchors give the page vertical structure so the
          short hero does not float in an empty tall mobile viewport. The hero
          centres itself via my-auto between the two anchors. */}
      <main id="main" className="mx-auto flex min-h-dvh max-w-3xl flex-col px-6 py-8 sm:py-10">
        <header className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
          <span aria-hidden="true" className="text-[var(--color-status-normal)]">
            ●
          </span>
          NEXUS
          <span className="font-normal text-[var(--color-ink-dim)]">· Meridian Stadium</span>
        </header>

        <div className="my-auto py-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
            Stadium Operations
          </p>
          <h1 className="mt-4 text-5xl font-bold tracking-tight sm:text-6xl">NEXUS</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--color-ink-muted)]">
            The AI teammate in the control room. NEXUS watches every operational feed, spots crowd
            risk before it happens, and tells you what to do — and why.
          </p>
          <p className="mt-4 max-w-2xl leading-relaxed text-[var(--color-ink-dim)]">
            Safety thresholds and crowd numbers are computed by a deterministic engine. Generative
            AI reasons on top of those facts; it never invents them.
          </p>
          <div className="mt-10">
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-lg bg-[var(--color-accent)] px-6 py-3 font-semibold text-[var(--color-void)] transition-colors hover:bg-[var(--color-accent-strong)]"
            >
              Open command center
            </Link>
          </div>
        </div>

        <footer className="text-xs text-[var(--color-ink-dim)]">
          FIFA World Cup 2026 operations demo · GenAI-central, safety-deterministic.
        </footer>
      </main>
    </>
  );
}
