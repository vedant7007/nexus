'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Counts up to `value` the first time it scrolls into view. The number is
 * always rendered (SSR shows the final value), so it is correct with no JS and
 * for reduced-motion users; the animation is pure polish layered on top.
 */
export function CountUp({
  value,
  durationMs = 1400,
  decimals = 0,
  prefix = '',
  suffix = '',
}: {
  value: number;
  durationMs?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setDisplay(value);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || started.current) continue;
          started.current = true;
          observer.disconnect();

          const start = performance.now();
          const tick = (now: number) => {
            const progress = Math.min(1, (now - start) / durationMs);
            // easeOutCubic for a natural deceleration.
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(value * eased);
            if (progress < 1) requestAnimationFrame(tick);
            else setDisplay(value);
          };
          setDisplay(0);
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [value, durationMs]);

  return (
    <span ref={ref} className="tnum">
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
