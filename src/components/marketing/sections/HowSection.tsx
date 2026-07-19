import { Reveal } from '@/components/marketing/Reveal';

import { Section } from './Section';

const STEPS = [
  {
    n: '01',
    title: 'Feeds stream in',
    body: 'A seeded simulator models 8 zones and 6 gates of a World Cup venue — densities, gate flow, arrivals — as a pure function of the scenario and elapsed time.',
  },
  {
    n: '02',
    title: 'The engine computes truth',
    body: 'Pure, tested functions turn raw feeds into density bands, gate utilization, ETAs and one overall risk level. Every safety number originates here — never the LLM.',
  },
  {
    n: '03',
    title: 'The AI reasons on top',
    body: 'Gemini is handed those facts and asked to explain them: a plain-language briefing, ranked recommendations, and multilingual incident understanding.',
  },
  {
    n: '04',
    title: 'You get a decision',
    body: 'A briefing that rewrites itself, a recommendation with a computed “110% → 92%” impact, and a triaged incident — each labelled AI or rule-based so you always know the source.',
  },
] as const;

export function HowSection() {
  return (
    <Section id="how" eyebrow="How it works" title="Four layers, one strict direction of trust.">
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <Reveal
            key={step.n}
            delay={index * 100}
            className="lift relative rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
          >
            <span className="text-3xl font-bold text-gradient">{step.n}</span>
            <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
              {step.body}
            </p>
            {index < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-[var(--color-border-strong)] lg:block"
              >
                →
              </span>
            )}
          </Reveal>
        ))}
      </div>
      <Reveal delay={200} className="mt-8 text-center text-sm text-[var(--color-ink-dim)]">
        Facts only ever flow engine → AI. The AI is always last, and always optional — if it&apos;s
        slow or unreachable, every panel falls back to a deterministic rule-based answer.
      </Reveal>
    </Section>
  );
}
