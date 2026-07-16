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
      <main
        id="main"
        className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-16"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
          Stadium Operations
        </p>
        <h1 className="mt-4 text-5xl font-bold tracking-tight sm:text-6xl">NEXUS</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--color-ink-muted)]">
          The AI teammate in the control room. NEXUS watches every operational feed, spots crowd
          risk before it happens, and tells you what to do — and why.
        </p>
        <p className="mt-4 max-w-2xl leading-relaxed text-[var(--color-ink-dim)]">
          Safety thresholds and crowd numbers are computed by a deterministic engine. Generative AI
          reasons on top of those facts; it never invents them.
        </p>
        <div className="mt-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-lg bg-[var(--color-accent)] px-6 py-3 font-semibold text-[var(--color-void)] transition-colors hover:bg-[var(--color-accent-strong)]"
          >
            Open command center
          </Link>
        </div>
      </main>
    </>
  );
}
