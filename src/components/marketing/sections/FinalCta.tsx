import Link from 'next/link';

import { Reveal } from '@/components/marketing/Reveal';

export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-[var(--color-border)]">
      <div className="aurora" aria-hidden="true" />
      <Reveal className="relative mx-auto max-w-3xl px-6 py-24 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Step into the control room.
        </h2>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-[var(--color-ink-muted)]">
          See the status climb, watch the AI explain itself, and report an incident in any language
          — the whole demo runs in under a minute.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <Link
            href="/dashboard"
            className="glow inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-7 py-3.5 font-semibold text-[var(--color-void)] transition-colors hover:bg-[var(--color-accent-strong)]"
          >
            Open command center
            <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/methodology"
            className="inline-flex items-center rounded-lg border border-[var(--color-border-strong)] px-7 py-3.5 font-semibold text-[var(--color-ink)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent-strong)]"
          >
            Read the methodology
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
