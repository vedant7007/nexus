import Link from 'next/link';

import { MiniConsole } from '@/components/marketing/MiniConsole';
import { Typewriter } from '@/components/marketing/Typewriter';

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="sr-only">{label}</dt>
      <dd className="text-lg font-bold text-[var(--color-ink)] tnum">{value}</dd>
      <span aria-hidden="true" className="text-[var(--color-ink-dim)]">
        {label}
      </span>
    </div>
  );
}

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden border-b border-[var(--color-border)]">
      <div className="aurora" aria-hidden="true" />
      <div className="grid-drift" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-32 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-36">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-strong)]">
            <span aria-hidden="true" className="text-[var(--color-status-normal)]">
              ●
            </span>
            FIFA World Cup 2026 · Stadium Operations
          </p>

          <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            <span className="text-gradient">NEXUS</span>
            <span className="mt-3 block text-2xl font-semibold text-[var(--color-ink-muted)] sm:text-3xl">
              The AI teammate that{' '}
              <span className="text-[var(--color-accent-strong)]">
                <Typewriter
                  phrases={[
                    'spots crowd danger first.',
                    'explains every decision.',
                    'speaks 30+ languages.',
                    'never invents a number.',
                  ]}
                />
              </span>
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-ink-muted)]">
            NEXUS watches every operational feed in the control room, spots crowd risk before it
            happens, and tells you what to do — and why. Any volunteer can report an incident in any
            language and get an instant, triaged response.
          </p>
          <p className="mt-4 max-w-xl leading-relaxed text-[var(--color-ink-dim)]">
            Safety thresholds and crowd numbers are computed by a deterministic engine. Generative
            AI reasons on top of those facts. It never invents them.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/dashboard"
              className="glow inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 py-3 font-semibold text-[var(--color-void)] transition-colors hover:bg-[var(--color-accent-strong)]"
            >
              Open command center
              <span aria-hidden="true">→</span>
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border-strong)] px-6 py-3 font-semibold text-[var(--color-ink)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent-strong)]"
            >
              See how it works
            </a>
          </div>

          <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <HeroStat value="30+" label="languages triaged" />
            <HeroStat value="< 2s" label="AI briefing latency" />
            <HeroStat value="483" label="tests green" />
          </dl>
        </div>

        <div className="float flex justify-center lg:justify-end">
          <MiniConsole />
        </div>
      </div>
    </section>
  );
}
