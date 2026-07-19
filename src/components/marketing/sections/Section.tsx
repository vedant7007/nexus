import type { ReactNode } from 'react';

import { Reveal } from '@/components/marketing/Reveal';

// Shared shell for the landing sections: a centred, revealed eyebrow + title
// over the section's content, with an optional tinted background.
export function Section({
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
