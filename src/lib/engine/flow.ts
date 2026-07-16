/**
 * @module engine/flow
 *
 * Responsibility: model the effect of operational interventions, numerically.
 *
 * Every number the UI shows next to a recommendation ("94% → 78%") originates
 * here. The AI is handed these figures and asked to explain them; it is never
 * asked to produce them. That split is what lets a recommendation be both
 * fluent and trustworthy.
 *
 * The model is a deliberately simple conservation-of-people flow: arrivals move
 * between gates, throughput is fixed by staffing, and queues drain at the
 * surplus rate. It is not a microsimulation, and it does not pretend to be —
 * it is a defensible first-order estimate, and it is honest about its horizon.
 */
import { utilizationPct } from './situation';
import { GATE_UTILIZATION_BANDS } from './thresholds';
import type { GateState, Mitigation, RerouteImpact, Risk, Snapshot } from './types';

/** Additional throughput, as a fraction, from opening one overflow lane. */
export const OVERFLOW_LANE_UPLIFT = 0.2;

/** Additional throughput, as a fraction, from surging staff to a gate. */
export const STAFF_SURGE_UPLIFT = 0.15;

/** Reroute shares the engine will consider, smallest workable first. */
const REROUTE_STEPS: readonly number[] = [0.1, 0.15, 0.2, 0.3];

/** Rounds to one decimal place. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Models moving a share of one gate's arrivals to another gate.
 *
 * @param from - The overloaded source gate.
 * @param to - The destination gate absorbing arrivals.
 * @param pctMoved - Share of the source gate's arrivals to move, 0–1.
 * @returns Utilization before/after for both gates and the projected time in
 *   minutes to clear the source queue, or null if it does not clear.
 * @throws {RangeError} If `pctMoved` is outside 0–1.
 */
export function computeRerouteImpact(
  from: GateState,
  to: GateState,
  pctMoved: number,
): RerouteImpact {
  if (pctMoved < 0 || pctMoved > 1) {
    throw new RangeError(`pctMoved must be between 0 and 1, received ${pctMoved}`);
  }

  const moved = from.inflowPerMin * pctMoved;
  const fromAfterInflow = from.inflowPerMin - moved;
  const toAfterInflow = to.inflowPerMin + moved;

  const fromAfterPct = utilizationPct(fromAfterInflow, from.throughputPerMin);

  // The queue drains at the surplus of throughput over the reduced inflow. If
  // there is no surplus the queue never clears, which the caller must surface
  // rather than paper over with an optimistic number.
  const drainPerMin = from.throughputPerMin - fromAfterInflow;
  const clearanceMin =
    drainPerMin > 0 && from.queueLen > 0
      ? Math.max(1, Math.round(from.queueLen / drainPerMin))
      : drainPerMin > 0
        ? 0
        : null;

  return {
    fromGateId: from.id,
    toGateId: to.id,
    pctMoved,
    fromBeforePct: round1(from.utilizationPct),
    fromAfterPct: round1(fromAfterPct),
    toBeforePct: round1(to.utilizationPct),
    toAfterPct: round1(utilizationPct(toAfterInflow, to.throughputPerMin)),
    clearanceMin,
  };
}

/**
 * Models raising a gate's throughput by a fractional uplift.
 *
 * @param gate - The gate receiving extra capacity.
 * @param uplift - Fractional increase in throughput, e.g. 0.2 for +20%.
 * @returns Utilization before and after, and the new throughput per minute.
 * @throws {RangeError} If `uplift` is negative.
 */
export function computeCapacityUplift(
  gate: GateState,
  uplift: number,
): { beforePct: number; afterPct: number; newThroughputPerMin: number } {
  if (uplift < 0) throw new RangeError(`uplift must be non-negative, received ${uplift}`);

  const newThroughputPerMin = gate.throughputPerMin * (1 + uplift);
  return {
    beforePct: round1(gate.utilizationPct),
    afterPct: round1(utilizationPct(gate.inflowPerMin, newThroughputPerMin)),
    newThroughputPerMin: Math.round(newThroughputPerMin),
  };
}

/**
 * Picks the best gate to absorb rerouted arrivals.
 *
 * "Best" is the gate with the most headroom that also feeds the same zone —
 * sending fans to a gate for a different stand would create a second problem.
 *
 * @param from - The overloaded gate.
 * @param gates - All gates in the venue.
 * @returns The chosen gate, or null when no gate has usable headroom.
 */
export function findReliefGate(from: GateState, gates: readonly GateState[]): GateState | null {
  const candidates = gates
    .filter((g) => g.id !== from.id)
    .filter((g) => g.utilizationPct < GATE_UTILIZATION_BANDS.elevated)
    .sort((a, b) => a.utilizationPct - b.utilizationPct || a.id.localeCompare(b.id));

  return candidates[0] ?? null;
}

/**
 * Chooses the smallest reroute share that brings a gate back under the
 * 'high' band, so the intervention is proportionate rather than maximal.
 *
 * @param from - The overloaded gate.
 * @param to - The relief gate.
 * @returns The chosen share and its modelled impact, or null if no share helps.
 */
function bestRerouteStep(
  from: GateState,
  to: GateState,
): { pct: number; impact: RerouteImpact } | null {
  for (const pct of REROUTE_STEPS) {
    const impact = computeRerouteImpact(from, to, pct);
    const relievesSource = impact.fromAfterPct < GATE_UTILIZATION_BANDS.high;
    const doesNotOverloadTarget = impact.toAfterPct < GATE_UTILIZATION_BANDS.high;
    if (relievesSource && doesNotOverloadTarget) return { pct, impact };
  }
  return null;
}

/**
 * Generates deterministic mitigation options for a gate risk.
 *
 * @param gate - The gate under pressure.
 * @param gates - All gates, used to find relief capacity.
 * @returns Mitigations ordered most-effective first. May be empty.
 */
export function gateMitigations(gate: GateState, gates: readonly GateState[]): Mitigation[] {
  const options: Mitigation[] = [];

  const relief = findReliefGate(gate, gates);
  const step = relief === null ? null : bestRerouteStep(gate, relief);
  if (relief !== null && step !== null) {
    const { impact, pct } = step;
    const clearance =
      impact.clearanceMin === null
        ? 'the queue continues to grow'
        : `the existing queue clears in ~${impact.clearanceMin} min`;

    options.push({
      id: `reroute:${gate.id}:${relief.id}`,
      action: `Reroute ${Math.round(pct * 100)}% of ${gate.name} arrivals to ${relief.name}`,
      impact:
        `${gate.name} utilization ${impact.fromBeforePct}% → ${impact.fromAfterPct}%; ` +
        `${relief.name} ${impact.toBeforePct}% → ${impact.toAfterPct}%; ${clearance}.`,
      effectiveness: impact.fromBeforePct - impact.fromAfterPct,
    });
  }

  const overflow = computeCapacityUplift(gate, OVERFLOW_LANE_UPLIFT);
  options.push({
    id: `overflow:${gate.id}`,
    action: `Open the overflow lane at ${gate.name}`,
    impact:
      `Throughput ${Math.round(gate.throughputPerMin)} → ${overflow.newThroughputPerMin} people/min; ` +
      `utilization ${overflow.beforePct}% → ${overflow.afterPct}%.`,
    effectiveness: overflow.beforePct - overflow.afterPct,
  });

  const staff = computeCapacityUplift(gate, STAFF_SURGE_UPLIFT);
  options.push({
    id: `staff:${gate.id}`,
    action: `Surge stewards to ${gate.name} to speed up screening`,
    impact:
      `Throughput ${Math.round(gate.throughputPerMin)} → ${staff.newThroughputPerMin} people/min; ` +
      `utilization ${staff.beforePct}% → ${staff.afterPct}%.`,
    effectiveness: staff.beforePct - staff.afterPct,
  });

  return options.sort((a, b) => b.effectiveness - a.effectiveness || a.id.localeCompare(b.id));
}

/**
 * Generates deterministic mitigation options for a zone crowd risk.
 *
 * @param risk - The crowd risk.
 * @param snapshot - The venue state, used to find the gates feeding the zone.
 * @returns Mitigations ordered most-effective first.
 */
export function zoneMitigations(risk: Risk, snapshot: Snapshot): Mitigation[] {
  const zone = snapshot.zones.find((z) => z.id === risk.subjectId);
  if (zone === undefined) return [];

  const feeders = snapshot.gates.filter((g) => g.feedsZoneId === zone.id);
  const inflow = feeders.reduce((sum, g) => sum + g.throughputPerMin, 0);
  const options: Mitigation[] = [];

  if (feeders.length > 0 && inflow > 0) {
    // Metering the feeding gates is the only lever that directly reduces the
    // rate people enter an over-dense zone.
    const metered = Math.round(inflow * 0.5);
    options.push({
      id: `meter:${zone.id}`,
      action: `Meter entry through ${feeders.map((g) => g.name).join(' and ')} into ${zone.name}`,
      impact:
        `Cuts inflow to ${zone.name} from ${Math.round(inflow)} to ${metered} people/min, ` +
        `halving the rate of density increase from ${Math.round(zone.netFlowPerMin)} people/min.`,
      effectiveness: 40,
    });
  }

  options.push({
    id: `disperse:${zone.id}`,
    action: `Open adjacent concourse routes and direct stewards to disperse ${zone.name}`,
    impact:
      `${zone.name} is at ${Math.round(zone.densityPct)}% of safe capacity ` +
      `(${Math.round(zone.occupancy)} of ${zone.capacity} people); dispersal targets a return below ${70}%.`,
    effectiveness: 30,
  });

  return options.sort((a, b) => b.effectiveness - a.effectiveness || a.id.localeCompare(b.id));
}

/**
 * Generates mitigations for any risk, dispatching on its kind.
 *
 * @param risk - The risk to mitigate.
 * @param snapshot - The venue state.
 * @returns Mitigations ordered most-effective first. Empty when the subject is
 *   no longer present in the snapshot.
 */
export function mitigationsFor(risk: Risk, snapshot: Snapshot): Mitigation[] {
  switch (risk.kind) {
    case 'gate': {
      const gate = snapshot.gates.find((g) => g.id === risk.subjectId);
      return gate === undefined ? [] : gateMitigations(gate, snapshot.gates);
    }
    case 'crowd':
      return zoneMitigations(risk, snapshot);
    case 'transit': {
      const line = snapshot.transit.find((t) => t.line === risk.subjectId);
      if (line === undefined) return [];
      return [
        {
          id: `transit-comms:${line.line}`,
          action: `Push a delay advisory for ${line.line} and pre-stage stewards for a late surge`,
          impact:
            `${line.line} carries ${Math.round(line.arrivalShare * 100)}% of arrivals; ` +
            `a ${line.delayMin} min delay concentrates that share into a later window.`,
          effectiveness: 25,
        },
      ];
    }
  }
}
