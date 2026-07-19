import Link from 'next/link';

import { Reveal } from '@/components/marketing/Reveal';

import { Section } from './Section';

export function TrustSection() {
  return (
    <Section
      id="trust"
      eyebrow="The one idea that makes it trustworthy"
      title="The AI has no shape in which to express a safety number."
      tint
    >
      <Reveal className="mx-auto max-w-2xl text-center text-[var(--color-ink-muted)]">
        <p className="leading-relaxed">
          Generative AI is the product&apos;s brain — it writes the briefings, explains the
          decisions, and understands incident reports in 30+ languages. But it is{' '}
          <span className="text-[var(--color-ink)]">structurally prevented</span> from deciding
          anything safety-critical.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        <Reveal className="lift rounded-xl border border-[var(--color-accent-dim)] bg-[var(--color-surface)] p-6">
          <p className="text-sm font-semibold text-[var(--color-accent-strong)]">The AI proposes</p>
          <p className="mt-2 text-2xl font-bold">a category</p>
          <p className="mt-3 leading-relaxed text-[var(--color-ink-muted)]">
            The triage model&apos;s output schema has{' '}
            <span className="text-[var(--color-ink)]">no severity field and no team field</span>.
            There is no shape in which it can express a triage decision — only the language, the
            English translation, and one of six categories.
          </p>
          <code className="mt-4 block rounded-lg border border-[var(--color-border)] bg-[var(--color-void)] p-3 text-xs text-[var(--color-ink-dim)]">
            {'{ language, englishText, category }  // no severity. by design.'}
          </code>
        </Reveal>

        <Reveal
          delay={120}
          className="lift rounded-xl border border-[color-mix(in_srgb,var(--color-status-normal)_45%,transparent)] bg-[var(--color-surface)] p-6"
        >
          <p className="text-sm font-semibold text-[var(--color-status-normal-text)]">
            The engine decides
          </p>
          <p className="mt-2 text-2xl font-bold">the severity</p>
          <p className="mt-3 leading-relaxed text-[var(--color-ink-muted)]">
            A deterministic keyword table scans{' '}
            <span className="text-[var(--color-ink)]">both</span> the raw report and the
            translation, so a mistranslation can&apos;t launder an emergency into a routine note. A
            life-safety term overrides the model&apos;s category outright.
          </p>
          <code className="mt-4 block rounded-lg border border-[var(--color-border)] bg-[var(--color-void)] p-3 text-xs text-[var(--color-status-normal-text)]">
            {'classifySeverity(report) → SEV-1 · Medical'}
          </code>
        </Reveal>
      </div>

      <Reveal
        delay={200}
        className="mx-auto mt-10 max-w-2xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-5 text-center text-sm text-[var(--color-ink-muted)]"
      >
        The consequence is testable, and tested: with Gemini switched off entirely,{' '}
        <span className="text-[var(--color-ink)]">&ldquo;hay una persona desmayada&rdquo;</span> is
        still SEV-1, still routed to Medical Response.{' '}
        <Link
          href="/methodology"
          className="font-semibold text-[var(--color-accent-strong)] hover:underline"
        >
          Read the methodology →
        </Link>
      </Reveal>
    </Section>
  );
}
