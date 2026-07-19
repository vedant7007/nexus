'use client';

import { useEffect, useState } from 'react';

/**
 * A self-contained, looping preview of the command center for the hero.
 *
 * It replays the "Gate C surge" arc — status climbing Normal → Critical, zone
 * density bars filling, the AI briefing rewriting itself — entirely client-side
 * on a timer, with no network calls. It is a faithful teaser of the real
 * `/dashboard`, not live data, and is marked aria-hidden as pure decoration.
 *
 * Reduced-motion users get the final, most-informative frame held static.
 */

type Level = 'normal' | 'elevated' | 'high' | 'critical';

const LEVEL_META: Record<Level, { word: string; icon: string; token: string }> = {
  normal: { word: 'Normal', icon: '●', token: 'normal' },
  elevated: { word: 'Elevated', icon: '◐', token: 'elevated' },
  high: { word: 'High', icon: '▲', token: 'high' },
  critical: { word: 'Critical', icon: '⬤', token: 'critical' },
};

interface Frame {
  level: Level;
  zones: readonly number[];
  briefing: string;
  metric: string | null;
}

const DEFAULT_FRAME: Frame = {
  level: 'normal',
  zones: [38, 44, 41, 35, 47, 40],
  briefing: 'Matchday filling on schedule. All zones within safe density. No action required.',
  metric: null,
};

const FRAMES: readonly Frame[] = [
  DEFAULT_FRAME,
  {
    level: 'elevated',
    zones: [52, 61, 74, 58, 63, 55],
    briefing: 'Arrivals at Gate C accelerating. North concourse trending up — worth a glance.',
    metric: 'Gate C utilization 96%',
  },
  {
    level: 'high',
    zones: [66, 79, 92, 71, 84, 68],
    briefing:
      'Gate C is taking 215 arrivals a minute but can only process 195. The queue is growing by 20 people a minute.',
    metric: 'Gate C utilization 110%',
  },
  {
    level: 'critical',
    zones: [72, 86, 99, 77, 90, 73],
    briefing:
      'Recommend: open the overflow lane at Gate C. Computed impact — utilization 110% → 92%.',
    metric: 'Gate C utilization 110% → 92%',
  },
];

const FRAME_MS = 2900;

function barColor(fill: number): string {
  if (fill > 90) return 'var(--color-status-critical)';
  if (fill > 75) return 'var(--color-status-high)';
  if (fill > 60) return 'var(--color-status-elevated)';
  return 'var(--color-status-normal)';
}

function ConsoleHeader({ accent }: { accent: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-ink-dim)]">
        <span className="relative flex h-2 w-2">
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-60"
            style={{ backgroundColor: accent }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: accent }}
          />
        </span>
        Meridian Stadium · live
      </div>
      <span className="rounded border border-[var(--color-accent-dim)] bg-[var(--color-accent-dim)]/40 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--color-accent-strong)]">
        AI
      </span>
    </div>
  );
}

function ZoneBars({ zones }: { zones: readonly number[] }) {
  return (
    <div className="mt-5 grid grid-cols-6 gap-1.5">
      {zones.map((fill, index) => (
        <div
          key={index}
          className="flex h-16 flex-col justify-end rounded bg-[var(--color-surface-raised)]"
        >
          <div
            className="rounded transition-[height,background-color] duration-700 ease-out"
            style={{ height: `${fill}%`, backgroundColor: barColor(fill) }}
          />
        </div>
      ))}
    </div>
  );
}

function FrameDots({ index, accent }: { index: number; accent: string }) {
  return (
    <div className="mt-4 flex justify-center gap-1.5">
      {FRAMES.map((_, dot) => (
        <span
          key={dot}
          className="h-1 rounded-full transition-all duration-500"
          style={{
            width: dot === index ? '1.25rem' : '0.375rem',
            backgroundColor: dot === index ? accent : 'var(--color-border-strong)',
          }}
        />
      ))}
    </div>
  );
}

export function MiniConsole() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setIndex(FRAMES.length - 1);
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % FRAMES.length);
    }, FRAME_MS);
    return () => window.clearInterval(timer);
  }, []);

  const frame = FRAMES[index] ?? DEFAULT_FRAME;
  const meta = LEVEL_META[frame.level];
  const accent = `var(--color-status-${meta.token})`;

  return (
    <div
      className="panel relative w-full max-w-md overflow-hidden p-5 transition-shadow duration-700"
      style={{ boxShadow: `0 0 0 1px ${accent}22, 0 24px 60px -30px ${accent}66` }}
      aria-hidden="true"
    >
      <ConsoleHeader accent={accent} />

      <div className="mt-4 flex items-center gap-3">
        <span
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-lg font-bold transition-colors duration-500"
          style={{ backgroundColor: `${accent}1f`, color: accent }}
        >
          <span aria-hidden="true">{meta.icon}</span>
          {meta.word}
        </span>
        <span className="text-xs text-[var(--color-ink-dim)]">overall risk</span>
      </div>

      <ZoneBars zones={frame.zones} />

      <div className="mt-4 h-4 text-xs font-medium text-[var(--color-ink-muted)] tnum">
        {frame.metric}
      </div>

      <div
        className="mt-2 min-h-[3.5rem] rounded-lg border-l-2 pl-3 text-sm leading-relaxed text-[var(--color-ink-muted)] transition-colors duration-500"
        style={{ borderColor: accent }}
      >
        {frame.briefing}
      </div>

      <FrameDots index={index} accent={accent} />
    </div>
  );
}
