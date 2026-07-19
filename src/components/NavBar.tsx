'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS: readonly { href: string; label: string }[] = [
  { href: '/dashboard', label: 'Command Center' },
  { href: '/incidents', label: 'Incidents' },
  { href: '/methodology', label: 'Methodology' },
];

/**
 * Primary navigation.
 *
 * `aria-current="page"` marks the active link for screen readers; the underline
 * and colour are the sighted equivalent, so the state is never colour-only.
 */
export function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="border-b border-[var(--color-border)] bg-[var(--color-void)]"
    >
      <ul className="mx-auto flex max-w-[100rem] gap-1 px-5">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-block border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                  active
                    ? 'border-[var(--color-accent)] text-[var(--color-accent-strong)]'
                    : 'border-transparent text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
