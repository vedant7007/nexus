/**
 * Produces realistic venue snapshots for a scenario and tick.
 *
 * Two decisions shape this module:
 *
 *  1. **It is a pure function of (scenario, tick), not a stateful loop.** Cloud
 *     Run may serve consecutive polls from different instances; anything held in
 *     process memory would make the feed jump between them. Deriving each
 *     snapshot from the tick index means every instance agrees, and a test can
 *     ask for tick 47 directly instead of stepping there.
 *
 *  2. **Randomness is seeded, never `Math.random()`.** The jitter that makes the
 *     feed feel alive is derived from (seed, tick, subject), so the same tick
 *     always yields the same numbers. A demo is reproducible and a failing test
 *     is debuggable.
 *
 * The arrival model is a first-order integration of a fill curve: arrivals per
 * minute peak shortly before kickoff, gates process what they can, and the
 * remainder queues. Occupancy is the integral of what actually got through.
 */
import { densityPct, utilizationPct } from '../engine/situation';
import type { GateState, Snapshot, TransitLine, ZoneState } from '../engine/types';

import { type Scenario, type ScenarioId, getScenario } from './scenarios';
import {
  GATES,
  type GateConfig,
  TRANSIT_LINES,
  TRANSIT_SHARE,
  UNFED_CAPACITY,
  VENUE_CAPACITY,
  ZONES,
} from './venue';

/** Simulated minutes advanced by one tick. */
export const MINUTES_PER_TICK = 1;

/** Tick 0 corresponds to this many minutes before kickoff. */
export const START_T_MINUS_MIN = 60;

/** Ticks after which the simulation stops advancing (kickoff + 30 min). */
export const MAX_TICK = 90;

/**
 * Share of total safe capacity that actually attends.
 *
 * Set below 1 deliberately. A real match rarely sells every seat, and the
 * signal matters more than the ticket count: at full attendance every zone
 * would sit near 100% of safe capacity and the dashboard would read 'critical'
 * on a perfectly ordinary matchday. An alarm that is always on is not an alarm.
 * At 90%, a busy normal matchday peaks at 'high' and only a genuine crisis
 * reaches 'critical'.
 */
const ATTENDANCE_RATE = 0.9;

/** Peak of the arrival curve, in minutes before kickoff. */
const ARRIVAL_PEAK_T_MINUS = 22;

/** Spread of the arrival curve in minutes; larger means a flatter fill. */
const ARRIVAL_SPREAD = 18;

/**
 * Deterministic pseudo-random value in [0, 1) from integer inputs.
 *
 * A small integer hash (mulberry32-style finaliser) rather than a PRNG object,
 * because callers need random-*looking* values addressable by coordinate, not a
 * sequence. Same inputs always produce the same output.
 */
export function seededNoise(seed: number, tick: number, subject: number): number {
  let h = (seed ^ (tick * 0x9e3779b1) ^ (subject * 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return h / 0x100000000;
}

// Symmetric jitter in [-magnitude, +magnitude] from seeded noise.
function jitter(seed: number, tick: number, subject: number, magnitude: number): number {
  return (seededNoise(seed, tick, subject) * 2 - 1) * magnitude;
}

/**
 * Total arrivals per minute across the venue at a given time.
 *
 * A Gaussian fill curve peaking shortly before kickoff, normalised by its own
 * spread so the integral is always full attendance. That normalisation is the
 * point: a scenario can shift or compress the curve to model a transit delay
 * without conjuring extra spectators into existence.
 */
export function arrivalRatePerMin(tMinusMin: number, peakShiftMin = 0, spreadScale = 1): number {
  const spread = ARRIVAL_SPREAD * spreadScale;
  const offset = tMinusMin - (ARRIVAL_PEAK_T_MINUS + peakShiftMin);
  const shape = Math.exp(-(offset * offset) / (2 * spread * spread));
  const total = VENUE_CAPACITY * ATTENDANCE_RATE;
  // Normalising constant for a Gaussian integrated over minutes; dividing by the
  // spread is what holds total attendance constant as the curve narrows.
  const norm = spread * Math.sqrt(2 * Math.PI);
  return (total / norm) * shape;
}

/** A gate's scenario-resolved parameters paired with its config. */
export interface GateShare {
  gate: GateConfig;
  /** Share of venue arrivals this gate receives, 0–1. */
  share: number;
  /** Scenario-adjusted processing capacity in people per minute. */
  throughputPerMin: number;
}

/**
 * Resolves each gate's share of arrivals under a scenario, renormalised to sum to 1.
 *
 * Renormalisation is what makes a scenario a *redistribution* rather than an
 * invention: tripling Gate C's multiplier sends a larger share of the same crowd
 * to Gate C, it does not add spectators to the venue.
 *
 * Gates are returned paired with their config rather than as a bare array, so
 * downstream code never has to index two arrays in parallel and hope they align.
 * Shares sum to 1 (or all zero in the degenerate case where every gate is closed).
 */
export function resolveGateShares(scenario: Scenario): GateShare[] {
  const weighted = GATES.map((gate) => ({
    gate,
    weight: gate.arrivalShare * (scenario.gateArrivalMultipliers[gate.id] ?? 1),
  }));
  const total = weighted.reduce((sum, w) => sum + w.weight, 0);

  return weighted.map(({ gate, weight }) => ({
    gate,
    share: total <= 0 ? 0 : weight / total,
    throughputPerMin:
      gate.baseThroughputPerMin * (scenario.gateThroughputMultipliers[gate.id] ?? 1),
  }));
}

/** Mutable accumulator for one gate as the simulation integrates forward. */
interface GateAccumulator {
  gate: GateConfig;
  queue: number;
  admitted: number;
  lastInflow: number;
  lastThroughput: number;
  lastAdmitted: number;
}

// Integrates gate queues and admissions from tick 0 up to targetTick (inclusive).
function integrateGates(targetTick: number, scenario: Scenario, seed: number): GateAccumulator[] {
  const resolved = resolveGateShares(scenario);
  const acc: GateAccumulator[] = resolved.map(({ gate }) => ({
    gate,
    queue: 0,
    admitted: 0,
    lastInflow: 0,
    lastThroughput: 0,
    lastAdmitted: 0,
  }));

  for (let tick = 0; tick <= targetTick; tick += 1) {
    const tMinus = START_T_MINUS_MIN - tick * MINUTES_PER_TICK;
    const venueRate = arrivalRatePerMin(tMinus, scenario.peakShiftMin, scenario.spreadScale);

    acc.forEach((state, i) => {
      const params = resolved[i];
      /* c8 ignore next -- acc is built by mapping `resolved`, so this cannot miss. */
      if (params === undefined) return;

      // ±8% jitter keeps the feed from looking mechanically smooth while
      // remaining fully reproducible for a given seed.
      const inflow = Math.max(0, venueRate * params.share * (1 + jitter(seed, tick, i, 0.08)));
      const capacity = Math.max(
        0,
        params.throughputPerMin * (1 + jitter(seed, tick, i + 100, 0.04)),
      );

      const available = state.queue + inflow * MINUTES_PER_TICK;
      const processed = Math.min(available, capacity * MINUTES_PER_TICK);

      state.queue = available - processed;
      state.admitted += processed;
      state.lastInflow = inflow;
      state.lastThroughput = capacity;
      state.lastAdmitted = processed / MINUTES_PER_TICK;
    });
  }

  return acc;
}

/**
 * Builds the zone states implied by what each gate has admitted.
 *
 * The model conserves people exactly. Everyone admitted at a gate lands in that
 * gate's entry zone, except for a {@link TRANSIT_SHARE} fraction who walk on to
 * a zone that has no gate of its own (upper tiers, far stands). That fraction is
 * derived from capacity, not tuned: if 26% of the seats can only be reached on
 * foot from a concourse, 26% of the crowd must walk there. The sum of all zone
 * occupancies therefore equals total admissions, which a test asserts.
 */
function buildZones(gateAcc: readonly GateAccumulator[], seed: number, tick: number): ZoneState[] {
  const totalAdmitted = gateAcc.reduce((sum, g) => sum + g.admitted, 0);
  const totalAdmitRate = gateAcc.reduce((sum, g) => sum + g.lastAdmitted, 0);

  return ZONES.map((zone, index) => {
    const feeders = gateAcc.filter((a) => a.gate.feedsZoneId === zone.id);

    let people: number;
    let flow: number;

    if (feeders.length > 0) {
      const admitted = feeders.reduce((sum, a) => sum + a.admitted, 0);
      const rate = feeders.reduce((sum, a) => sum + a.lastAdmitted, 0);
      people = admitted * (1 - TRANSIT_SHARE);
      flow = rate * (1 - TRANSIT_SHARE);
    } else {
      // Share the through-flow among gateless zones in proportion to capacity.
      // UNFED_CAPACITY is positive for any venue with a gateless zone, which is
      // the only way to reach this branch; a test pins that invariant.
      const shareOfUnfed = zone.capacity / UNFED_CAPACITY;
      people = totalAdmitted * TRANSIT_SHARE * shareOfUnfed;
      flow = totalAdmitRate * TRANSIT_SHARE * shareOfUnfed;
    }

    // ±3% jitter reflects that a zone's headcount is estimated from sensors,
    // not known exactly. The cap models physical overspill into aisles.
    const occupancy = Math.max(
      0,
      Math.min(zone.capacity * 1.05, people * (1 + jitter(seed, tick, index, 0.03))),
    );

    return {
      id: zone.id,
      name: zone.name,
      occupancy,
      capacity: zone.capacity,
      densityPct: densityPct(occupancy, zone.capacity),
      netFlowPerMin: flow,
    };
  });
}

// Builds gate states from integrated accumulators.
function buildGates(gateAcc: readonly GateAccumulator[]): GateState[] {
  return gateAcc.map((acc) => ({
    id: acc.gate.id,
    name: acc.gate.name,
    inflowPerMin: acc.lastInflow,
    throughputPerMin: acc.lastThroughput,
    queueLen: acc.queue,
    utilizationPct: utilizationPct(acc.lastInflow, acc.lastThroughput),
    feedsZoneId: acc.gate.feedsZoneId,
  }));
}

// Builds transit line states under a scenario.
function buildTransit(scenario: Scenario): TransitLine[] {
  return TRANSIT_LINES.map((line) => {
    const delayMin = scenario.transitDelays[line.line] ?? 0;
    return {
      line: line.line,
      status: delayMin > 0 ? 'delayed' : 'ok',
      delayMin,
      arrivalShare: line.arrivalShare,
    };
  });
}

/**
 * Produces a self-consistent venue snapshot for a scenario at a tick.
 *
 * `tick` is clamped to [0, MAX_TICK]; `seed` is fixed by default so demos are
 * reproducible.
 */
export function simulate(scenarioId: ScenarioId, tick: number, seed = 1337): Snapshot {
  const scenario = getScenario(scenarioId);
  const clampedTick = Math.max(0, Math.min(MAX_TICK, Math.floor(tick)));
  const tMinusKickoffMin = START_T_MINUS_MIN - clampedTick * MINUTES_PER_TICK;

  const gateAcc = integrateGates(clampedTick, scenario, seed);
  const zones = buildZones(gateAcc, seed, clampedTick);
  const gates = buildGates(gateAcc);
  const inside = zones.reduce((sum, z) => sum + z.occupancy, 0);

  // Energy and water track occupancy: an empty stadium draws its base load,
  // a full one drives HVAC, lighting, catering and sanitation to peak.
  const occupancyRatio = Math.min(1, inside / VENUE_CAPACITY);
  const energyKwh = 2_400 * scenario.energyMultiplier * (0.55 + 0.45 * occupancyRatio);

  return {
    tMinusKickoffMin,
    tick: clampedTick,
    zones,
    gates,
    transit: buildTransit(scenario),
    weather: {
      tempC: scenario.tempC,
      condition: scenario.condition,
      humidityPct: scenario.humidityPct,
    },
    resources: {
      energyKwh,
      wasteDiversionPct: 72 + jitter(seed, clampedTick, 900, 6),
      waterLitres: 18_000 * (0.4 + 0.6 * occupancyRatio),
      publicTransportSharePct: 62 + jitter(seed, clampedTick, 901, 4),
    },
  };
}

/**
 * Derives the current tick from elapsed wall-clock time.
 *
 * Kept separate from {@link simulate} so the simulator itself stays pure: this
 * is the only place the clock enters the simulation. Returns a tick clamped to
 * the simulation window. `msPerTick` defaults to 3s, which compresses the
 * 90-minute window into a ~4.5-minute demo.
 */
export function tickForElapsed(startedAtMs: number, nowMs: number, msPerTick = 3_000): number {
  const elapsed = Math.max(0, nowMs - startedAtMs);
  return Math.min(MAX_TICK, Math.floor(elapsed / msPerTick));
}
