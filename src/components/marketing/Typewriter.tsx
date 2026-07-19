'use client';

import { useEffect, useState } from 'react';

/**
 * Types out each phrase, holds, deletes, and advances to the next — a live
 * terminal feel for the hero. A blinking caret rides on the `.caret` utility.
 *
 * Honours reduced-motion: if the user asked the OS for less motion we skip the
 * animation entirely and render the first phrase as static text (no caret),
 * so the headline is always legible and never jitters.
 */
export function Typewriter({
  phrases,
  typeMs = 55,
  deleteMs = 28,
  holdMs = 1600,
}: {
  phrases: readonly string[];
  typeMs?: number;
  deleteMs?: number;
  holdMs?: number;
}) {
  const [text, setText] = useState('');
  const [index, setIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (reduced || phrases.length === 0) return;

    const current = phrases[index % phrases.length] ?? '';

    if (!deleting && text === current) {
      const hold = window.setTimeout(() => setDeleting(true), holdMs);
      return () => window.clearTimeout(hold);
    }
    if (deleting && text === '') {
      setDeleting(false);
      setIndex((value) => (value + 1) % phrases.length);
      return;
    }

    const step = window.setTimeout(
      () => {
        setText((value) =>
          deleting ? current.slice(0, value.length - 1) : current.slice(0, value.length + 1),
        );
      },
      deleting ? deleteMs : typeMs,
    );
    return () => window.clearTimeout(step);
  }, [text, deleting, index, phrases, reduced, typeMs, deleteMs, holdMs]);

  if (reduced) {
    return <span>{phrases[0] ?? ''}</span>;
  }

  return (
    <span className="caret" aria-live="polite">
      {text}
    </span>
  );
}
