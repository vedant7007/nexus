'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

/**
 * Scroll-reveal wrapper — progressive enhancement.
 *
 * The server renders the children fully visible (no hiding class), so crawlers,
 * no-JS visitors, and reduced-motion users always see the content. On mount, if
 * it can genuinely animate (JS + IntersectionObserver present, motion allowed),
 * it "arms" the element — hides it — then adds `.is-in` the first time it
 * scrolls into view, letting CSS settle it in. It observes once, then
 * disconnects; a revealed section never un-reveals. If JS never runs or motion
 * is reduced, the element simply stays visible.
 */
export function Reveal({
  as,
  children,
  delay = 0,
  className = '',
}: {
  as?: ElementType;
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const Tag = as ?? 'div';
  const ref = useRef<HTMLElement | null>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      return; // Leave the element visible; no animation to run.
    }

    setArmed(true);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${armed ? 'reveal-armed' : ''} ${shown ? 'is-in' : ''} ${className}`.trim()}
      style={delay && armed ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
