import type { Metadata } from 'next';

import {
  ImpactSection,
  InterlockSection,
  SeveritySection,
  ThresholdsSection,
  VenueSection,
} from '@/components/methodology/Sections';
import { NavBar } from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'Methodology',
  description:
    'How NEXUS decides what is dangerous: the density thresholds and their source, the severity rules, and why the AI has no shape in which to express a severity.',
};

/**
 * The methodology and trust page.
 *
 * @returns The page.
 */
export default function MethodologyPage() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-4xl px-5 py-3.5">
          <h1 className="text-base font-bold tracking-tight">Methodology</h1>
        </div>
      </header>
      <NavBar />

      <main id="main" className="mx-auto max-w-4xl space-y-4 px-5 py-8">
        <p className="text-base leading-relaxed text-[var(--color-ink)]">
          NEXUS puts generative AI at the centre of the control room and gives it no authority over
          safety. Everything below is what the system actually runs — these numbers are imported
          from the engine, not transcribed onto this page.
        </p>

        <InterlockSection />
        <ThresholdsSection />
        <SeveritySection />
        <ImpactSection />
        <VenueSection />
      </main>
    </>
  );
}
