'use client';

// An earlier version keyed the child on the token to restart the animation,
// which remounted the panel — collapsing and re-expanding it and causing a large
// cumulative layout shift every time the board escalated. This toggles a class
// instead. The animation only touches border-colour and box-shadow, neither of
// which affects layout, so the cue costs zero CLS.
import { useEffect, useRef, useState } from 'react';

/** How long the escalation outline lingers, in milliseconds. */
const FLASH_MS = 900;

export interface EscalationFlashProps {
  /** A value that increments on each escalation. See {@link useEscalation}. */
  token: number;
  children: React.ReactNode;
}

/** Outlines its children for {@link FLASH_MS} whenever `token` changes. */
export function EscalationFlash({ token, children }: EscalationFlashProps) {
  const [flashing, setFlashing] = useState(false);
  // The first render establishes a baseline; only later increments flash, so a
  // page that loads already-escalated does not fire on arrival.
  const seenFirst = useRef(false);

  useEffect(() => {
    if (!seenFirst.current) {
      seenFirst.current = true;
      return;
    }
    setFlashing(true);
    const timer = setTimeout(() => setFlashing(false), FLASH_MS);
    return () => clearTimeout(timer);
  }, [token]);

  return (
    <div className={`rounded-[var(--radius-panel)] ${flashing ? 'flash-escalate' : ''}`}>
      {children}
    </div>
  );
}
