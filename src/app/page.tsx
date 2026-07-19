import Link from 'next/link';
import type { ReactNode } from 'react';

import { CountUp } from '@/components/marketing/CountUp';
import { LandingNav } from '@/components/marketing/LandingNav';
import { MiniConsole } from '@/components/marketing/MiniConsole';
import { Reveal } from '@/components/marketing/Reveal';
import { Typewriter } from '@/components/marketing/Typewriter';

/**
 * Public landing page — the front door to NEXUS.
 *
 * A server component that composes small client "islands" (the nav, the
 * typewriter, scroll-reveal wrappers, count-ups, and the looping console
 * preview) over otherwise static, crawlable HTML. It deliberately avoids
 * Firebase and any chart library so it stays cheap to load and fast to paint;
 * the motion is CSS-driven and fully neutralised under prefers-reduced-motion.
 */
export default function HomePage() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <LandingNav />

      <main id="main">
        <HeroSection />
        <LanguageTicker />
        <WhatSection />
        <TrustSection />
        <HowSection />
        <FeaturesSection />
        <DemoSection />
        <StatsSection />
        <StackSection />
        <FinalCta />
      </main>

      <SiteFooter />
    </>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */

function HeroSection() {
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

/* ── Language ticker ──────────────────────────────────────────────────────── */

const INCIDENT_PHRASES = [
  { lang: 'Spanish', text: 'hay una persona desmayada' },
  { lang: 'Bengali', text: 'একজন অজ্ঞান হয়ে পড়েছে' },
  { lang: 'Hindi', text: 'एक व्यक्ति बेहोश हो गया' },
  { lang: 'French', text: "une personne s'est évanouie" },
  { lang: 'Arabic', text: 'شخص فقد وعيه' },
  { lang: 'Portuguese', text: 'uma pessoa desmaiou' },
  { lang: 'German', text: 'eine Person ist ohnmächtig' },
  { lang: 'Japanese', text: '気を失った人がいます' },
] as const;

function LanguageTicker() {
  return (
    <section
      aria-label="Multilingual incident examples"
      className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/40 py-6"
    >
      <p className="mx-auto mb-4 max-w-6xl px-6 text-center text-xs uppercase tracking-[0.16em] text-[var(--color-ink-dim)]">
        Any language in · one triaged decision out — every phrase below resolves to{' '}
        <span className="text-[var(--color-status-critical-text)]">SEV-1 · Medical Response</span>
      </p>
      <div className="marquee-mask overflow-hidden">
        <div className="marquee gap-3">
          {[...INCIDENT_PHRASES, ...INCIDENT_PHRASES].map((phrase, index) => (
            <span
              key={index}
              className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-1.5 text-sm text-[var(--color-ink-muted)]"
            >
              <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--color-ink-dim)]">
                {phrase.lang}
              </span>
              <span>{phrase.text}</span>
              <span aria-hidden="true" className="text-[var(--color-status-critical)]">
                →
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── What is NEXUS ────────────────────────────────────────────────────────── */

function WhatSection() {
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
            {[
              'Reads every feed continuously and computes a single, honest overall risk level.',
              'Rewrites the situation into plain language the moment it changes — no dashboards to decode.',
              'Proposes the next action with a real, engine-computed impact number attached.',
              'Turns any volunteer’s report, in any language, into a triaged, routed response.',
            ].map((item) => (
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

/* ── Trust interlock ──────────────────────────────────────────────────────── */

function TrustSection() {
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

/* ── How it works ─────────────────────────────────────────────────────────── */

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

function HowSection() {
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

/* ── Features ─────────────────────────────────────────────────────────────── */

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

function FeaturesSection() {
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

/* ── Demo arc ─────────────────────────────────────────────────────────────── */

const DEMO_STEPS = [
  'Open the command center. A normal matchday is filling; overall status reads Normal.',
  'Pick the “Gate C surge” scenario. The engine reacts and the status pill climbs Normal → High → Critical.',
  'The AI briefing rewrites itself: “Gate C is taking 215 arrivals a minute but can only process 195…”',
  'A recommendation appears with reasoning and a computed impact: “Open the overflow lane. 110% → 92%.”',
  'Switch to Incidents, type in Spanish, and watch it triage SEV-1 → Medical — with the rule quoted.',
] as const;

function DemoSection() {
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

/* ── Stats ────────────────────────────────────────────────────────────────── */

function StatsSection() {
  return (
    <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]/40 py-16">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 text-center lg:grid-cols-4">
        <StatItem value={30} suffix="+" label="languages understood" />
        <StatItem value={483} label="automated tests, all green" />
        <StatItem value={95} suffix="%+" label="safety-engine coverage" />
        <StatItem value={100} suffix="%" label="deterministic safety math" />
      </div>
    </section>
  );
}

function StatItem({ value, suffix, label }: { value: number; suffix?: string; label: string }) {
  return (
    <Reveal>
      <p className="text-4xl font-bold text-gradient sm:text-5xl">
        <CountUp value={value} suffix={suffix} />
      </p>
      <p className="mt-2 text-sm text-[var(--color-ink-dim)]">{label}</p>
    </Reveal>
  );
}

/* ── Stack ────────────────────────────────────────────────────────────────── */

const STACK = [
  'Next.js 15',
  'React 19',
  'TypeScript · strict',
  'Vertex AI · Gemini 2.5-flash',
  'Zod-validated boundaries',
  'Deterministic engine',
  'Firestore',
  'Cloud Run',
] as const;

function StackSection() {
  return (
    <Section eyebrow="Under the hood" title="Engineered to be believed, not just demoed.">
      <Reveal className="flex flex-wrap justify-center gap-3">
        {STACK.map((item) => (
          <span
            key={item}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-ink)]"
          >
            {item}
          </span>
        ))}
      </Reveal>
    </Section>
  );
}

/* ── Final CTA ────────────────────────────────────────────────────────────── */

function FinalCta() {
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

/* ── Footer ───────────────────────────────────────────────────────────────── */

function SiteFooter() {
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

/* ── Section shell ────────────────────────────────────────────────────────── */

function Section({
  id,
  eyebrow,
  title,
  tint = false,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  tint?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-20 border-b border-[var(--color-border)] py-20 ${
        tint ? 'bg-[var(--color-surface)]/30' : ''
      }`}
    >
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-strong)]">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
        </Reveal>
        {children}
      </div>
    </section>
  );
}
