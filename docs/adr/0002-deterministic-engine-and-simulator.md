# ADR-0002: A pure engine and a seeded, stateless simulator

## Context

The command center shows live, escalating operational state and must be
reproducible: a demo has to hit the same "Gate C surge" every time, tests have to
assert exact numbers, and multiple Cloud Run instances serving consecutive polls
must agree on what "now" looks like.

## Decision

- **The engine is a pure function of its inputs.** Thresholds, risk assessment,
  the crowd-flow model, severity, and sustainability are all pure and separately
  tested to ≥95% coverage. No I/O, no clock, no globals.
- **The simulator is a pure function of `(scenario, tick)`** rather than a
  stateful loop. The "current" snapshot is derived from the elapsed tick, not
  accumulated in memory.

## Consequences

- Stateless instances agree: two Cloud Run replicas asked for tick _N_ return the
  identical snapshot, so polling clients never see the state flicker between
  replicas.
- Any tick is directly addressable from a test — no need to run the sim forward.
- Calibration is a first-class concern: the model conserves people (a transit
  delay is the same crowd arriving later and tighter, not invented spectators),
  and a normal matchday peaks at "high" so "critical" still means something.
  Three modelling flaws (gate throughput too low to fill the venue, arrival shares
  ignoring downstream zone capacity, scenarios inventing spectators) were caught
  by tests and corrected here rather than papered over in the UI.
- Cost: the simulator cannot model true feedback loops (a decision changing future
  arrivals). Acceptable — the product's job is decision _support_ for a short
  horizon, not a full agent-based crowd simulation.
