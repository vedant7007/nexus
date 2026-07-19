'use client';

// Detects when the overall risk level rises, so the UI can react to an
// escalation as an event rather than a silent value change.
import { useEffect, useRef, useState } from 'react';

import type { RiskLevel } from '../engine/types';

/** Ordering of levels, calm to emergency. */
const ORDER: readonly RiskLevel[] = ['normal', 'elevated', 'high', 'critical'];

/**
 * Reports a monotonically increasing token that ticks up each time the level
 * *rises* (never on a fall or a repeat).
 *
 * Feeding the token to a component's `key`, or to a className toggle, re-triggers
 * a one-shot CSS animation exactly on escalation — the "control room reacting"
 * cue. A de-escalation is deliberately silent: calm returning is not an alarm.
 */
export function useEscalation(level: RiskLevel | null): number {
  const previous = useRef<RiskLevel | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    if (level === null) return;

    const before = previous.current;
    previous.current = level;

    // Only a rise counts. The first reading establishes a baseline silently, so
    // landing on an already-critical board does not fire a spurious flash.
    if (before !== null && ORDER.indexOf(level) > ORDER.indexOf(before)) {
      setToken((t) => t + 1);
    }
  }, [level]);

  return token;
}
