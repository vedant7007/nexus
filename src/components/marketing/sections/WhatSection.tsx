import { Reveal } from '@/components/marketing/Reveal';

import { Section } from './Section';

const WHAT_NEXUS_DOES = [
  'Reads every feed continuously and computes a single, honest overall risk level.',
  'Rewrites the situation into plain language the moment it changes — no dashboards to decode.',
  'Proposes the next action with a real, engine-computed impact number attached.',
  'Turns any volunteer’s report, in any language, into a triaged, routed response.',
] as const;

export function WhatSection() {
  return (
    <Section id="what" eyebrow="The problem" title="A World Cup control room drowns in feeds.">
      <div className="grid gap-10 lg:grid-cols-2">
        <Reveal className="space-y-4 text-[var(--color-ink-muted)]">
          <p className="leading-relaxed">
            In 2026, millions of fans pour through turnstiles across 16 host venues. In each control
            room, a handful of staff watch dozens of camera feeds, density sensors, gate counters
            and radio channels at once — and a dangerous crowd surge can build in the ninety seconds
            it takes to notice one screen among many.
          </p>
          <p className="leading-relaxed">
            The failure mode isn&apos;t a lack of data. It&apos;s a lack of{' '}
            <span className="text-[var(--color-ink)]">attention</span>: too many signals, too little
            time to turn them into a decision anyone can act on and defend.
          </p>
        </Reveal>

        <Reveal
          delay={120}
          className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-accent-strong)]">
            What NEXUS does
          </p>
          <ul className="space-y-3 text-[var(--color-ink-muted)]">
            {WHAT_NEXUS_DOES.map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden="true" className="mt-1 text-[var(--color-status-normal)]">
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </Section>
  );
}
