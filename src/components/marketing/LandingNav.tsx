'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/** The in-page sections the nav links to and spies on, in document order. */
const SECTIONS = [
  { id: 'what', label: 'What it is' },
  { id: 'trust', label: 'Trust' },
  { id: 'how', label: 'How it works' },
  { id: 'features', label: 'Capabilities' },
  { id: 'demo', label: 'Live demo' },
] as const;

/** The desktop section links, with the in-view section marked. */
function NavLinks({ active }: { active: string }) {
  return (
    <ul className="hidden items-center gap-1 md:flex">
      {SECTIONS.map((section) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            aria-current={active === section.id ? 'true' : undefined}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              active === section.id
                ? 'text-[var(--color-accent-strong)]'
                : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
            }`}
          >
            {section.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * The landing-page top bar.
 *
 * Three progressive-enhancement behaviours, all pure decoration over a nav that
 * works statically: a scroll-progress rail across the very top, a frosted
 * background that fades in once the hero is scrolled past, and scroll-spy that
 * marks the section currently in view. All state is client-only; the links are
 * plain anchors so they work before hydration.
 */
export function LandingNav() {
  const [progress, setProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setProgress(max > 0 ? (doc.scrollTop / max) * 100 : 0);
      setScrolled(doc.scrollTop > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    for (const { id } of SECTIONS) {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? 'border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-void)_82%,transparent)] backdrop-blur-md'
          : 'border-b border-transparent'
      }`}
    >
      <div
        aria-hidden="true"
        className="h-0.5 origin-left bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-status-normal)]"
        style={{ transform: `scaleX(${progress / 100})` }}
      />
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <a
          href="#top"
          className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]"
        >
          <span aria-hidden="true" className="text-[var(--color-status-normal)]">
            ●
          </span>
          NEXUS
        </a>

        <NavLinks active={active} />

        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent-strong)]"
        >
          Launch console
        </Link>
      </nav>
    </header>
  );
}
