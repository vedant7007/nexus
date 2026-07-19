'use client';

// The only clock in the UI. Everything that needs "now" reads this tick, so the
// snapshot, the briefing, and the incident form describe the same instant —
// panels driving their own timers would drift and show two different stadiums.
import { useEffect, useState } from 'react';

import { MAX_TICK, tickForElapsed } from '../sim/simulator';

import { DEMO_START_TICK, SIM_POLL_MS } from './constants';

/** The simulation clock. */
export interface SimClock {
  tick: number;
  /** True once the run has reached the end of its window. */
  finished: boolean;
  /** Restarts the run from tick 0. */
  restart: () => void;
}

/** Advances the simulation tick in real time. */
export function useSimClock(): SimClock {
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [tick, setTick] = useState(DEMO_START_TICK);

  useEffect(() => {
    // Offset the wall clock so t=0 maps to DEMO_START_TICK. The feed opens
    // partway through the fill, where a crisis scenario diverges from a normal
    // matchday within seconds instead of after a minute of an empty stadium —
    // an operator (or a judge) picking "gate surge" sees it escalate live.
    const advance = (): void =>
      setTick(
        Math.min(MAX_TICK, DEMO_START_TICK + tickForElapsed(startedAt, Date.now(), SIM_POLL_MS)),
      );
    advance();

    const timer = setInterval(advance, SIM_POLL_MS);
    return () => clearInterval(timer);
  }, [startedAt]);

  return {
    tick,
    finished: tick >= MAX_TICK,
    restart: () => {
      setStartedAt(Date.now());
      setTick(DEMO_START_TICK);
    },
  };
}
