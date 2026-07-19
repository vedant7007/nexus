import { Reveal } from '@/components/marketing/Reveal';

import { Section } from './Section';

const FEATURES = [
  {
    icon: '◐',
    title: 'Live situational briefings',
    body: 'The overall picture rewritten in plain language the instant it changes — the AI narrates, the engine supplies the numbers.',
  },
  {
    icon: '▲',
    title: 'Decisions with computed impact',
    body: 'Every recommendation carries a real, first-order impact figure from a conservation-of-people flow model. “Open the overflow lane: 110% → 92%.”',
  },
  {
    icon: '⬤',
    title: 'Multilingual incident triage',
    body: 'A volunteer reports in any of 30+ languages; NEXUS detects, translates, and triages — with the exact rule that fired quoted for audit.',
  },
  {
    icon: '●',
    title: 'Resilient by design',
    body: 'AI down? Rate-limited? Every route degrades gracefully to a rule-based answer. The control room never goes dark.',
  },
  {
    icon: '◇',
    title: 'Sustainability at a glance',
    body: 'Energy, waste, water and transit metrics with an AI insight line — the operational and the responsible, side by side.',
  },
  {
    icon: '✓',
    title: 'Accessible & audited',
    body: 'WCAG-AA contrast, full keyboard paths, reduced-motion honoured, and a11y asserted in the test suite — not an afterthought.',
  },
] as const;

export function FeaturesSection() {
  return (
    <Section
      id="features"
      eyebrow="Capabilities"
      title="Everything a control room needs, nothing it doesn’t."
      tint
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, index) => (
          <Reveal
            key={feature.title}
            delay={(index % 3) * 90}
            className="lift group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-accent-dim)]/50 text-lg text-[var(--color-accent-strong)] transition-transform duration-300 group-hover:scale-110"
            >
              {feature.icon}
            </span>
            <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
              {feature.body}
            </p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
