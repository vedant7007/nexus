import Link from 'next/link';

import { Reveal } from '@/components/marketing/Reveal';

import { Section } from './Section';

const DEMO_STEPS = [
  'Open the command center. A normal matchday is filling; overall status reads Normal.',
  'Pick the “Gate C surge” scenario. The engine reacts and the status pill climbs Normal → High → Critical.',
  'The AI briefing rewrites itself: “Gate C is taking 215 arrivals a minute but can only process 195…”',
  'A recommendation appears with reasoning and a computed impact: “Open the overflow lane. 110% → 92%.”',
  'Switch to Incidents, type in Spanish, and watch it triage SEV-1 → Medical — with the rule quoted.',
] as const;

export function DemoSection() {
  return (
    <Section id="demo" eyebrow="The 20-second demo" title="Watch the room react in real time.">
      <ol className="mx-auto max-w-3xl space-y-4">
        {DEMO_STEPS.map((step, index) => (
          <Reveal
            as="li"
            key={index}
            delay={index * 80}
            className="lift flex items-start gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-accent-dim)] bg-[var(--color-accent-dim)]/40 text-sm font-bold text-[var(--color-accent-strong)] tnum">
              {index + 1}
            </span>
            <p className="leading-relaxed text-[var(--color-ink-muted)]">{step}</p>
          </Reveal>
        ))}
      </ol>
      <Reveal delay={160} className="mt-10 text-center">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 py-3 font-semibold text-[var(--color-void)] transition-colors hover:bg-[var(--color-accent-strong)]"
        >
          Run the demo yourself
          <span aria-hidden="true">→</span>
        </Link>
      </Reveal>
    </Section>
  );
}
