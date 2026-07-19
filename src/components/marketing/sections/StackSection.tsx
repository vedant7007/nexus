import { Reveal } from '@/components/marketing/Reveal';

import { Section } from './Section';

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

export function StackSection() {
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
