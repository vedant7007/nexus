/**
 * @module engine/situation
 *
 * Responsibility: turn a raw Snapshot into the authoritative SituationReport.
 *
 * This is the deterministic pre-pass that everything else depends on. The UI
 * renders it, the AI is handed it as ground truth, and the fallbacks template
 * from it. It is a pure function of its inputs: same snapshot in, same report
 * out, no clock, no randomness, no I/O.
 */
import {
  DENSITY_BANDS,
  ETA_HORIZON_MIN,
  GATE_QUEUE_CRITICAL,
  TRANSIT_DELAY_ELEVATED_MIN,
  TRANSIT_DELAY_HIGH_MIN,
  classifyDensity,
  classifyGateUtilization,
  escalate,
  isHeatStress,
  levelScore,
  maxRiskLevel,
} from './thresholds';
import type { GateState, Risk, RiskLevel, Snapshot, SituationReport, ZoneState } from './types';

/** Rounds to one decimal place, avoiding float noise in rendered output. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Projects minutes until a zone reaches critical density at its current rate.
 *
 * @param zone - The zone to project.
 * @returns Minutes to critical, or undefined when flat, improving, already
 *   critical, or beyond the useful planning horizon.
 */
export function etaToCriticalMin(zone: ZoneState): number | undefined {
  if (zone.netFlowPerMin <= 0) return undefined;
  if (zone.densityPct >= DENSITY_BANDS.critical) return undefined;
  if (zone.capacity <= 0) return undefined;

  const criticalOccupancy = (DENSITY_BANDS.critical / 100) * zone.capacity;
  const peopleUntilCritical = criticalOccupancy - zone.occupancy;
  if (peopleUntilCritical <= 0) return undefined;

  const minutes = peopleUntilCritical / zone.netFlowPerMin;
  return minutes > ETA_HORIZON_MIN ? undefined : Math.max(1, Math.round(minutes));
}

/**
 * Builds the risk entry for a zone, or null when the zone is unremarkable.
 *
 * @param zone - The zone to assess.
 * @param heatStress - Whether ambient conditions warrant escalation.
 * @returns A Risk, or null if the zone is at a normal density.
 */
function assessZone(zone: ZoneState, heatStress: boolean): Risk | null {
  const base = classifyDensity(zone.densityPct);
  if (base === 'normal') return null;

  // Heat compounds crowd pressure: the same density is materially more
  // dangerous when a standing crowd cannot shed heat, so escalate one band.
  const level = heatStress ? escalate(base) : base;
  const eta = etaToCriticalMin(zone);

  const detail = [
    `${zone.name} is at ${round1(zone.densityPct)}% of safe capacity`,
    `(${Math.round(zone.occupancy)} of ${zone.capacity} people)`,
    eta === undefined ? '' : `, projected to reach critical in ~${eta} min at the current rate`,
    heatStress ? ', escalated one band for heat stress' : '',
    '.',
  ].join('');

  return {
    id: `crowd:${zone.id}`,
    kind: 'crowd',
    subjectId: zone.id,
    subjectName: zone.name,
    level,
    ...(eta === undefined ? {} : { etaToCriticalMin: eta }),
    detail,
    // A near-term ETA is what makes a risk actionable, so weight it: a zone
    // 5 minutes from critical outranks one 25 minutes away at the same band.
    score: levelScore(level) + (eta === undefined ? 0 : Math.max(0, ETA_HORIZON_MIN - eta)),
  };
}

/**
 * Builds the risk entry for a gate, or null when the gate is coping.
 *
 * @param gate - The gate to assess.
 * @returns A Risk, or null if utilization and queue are both normal.
 */
function assessGate(gate: GateState): Risk | null {
  const utilLevel = classifyGateUtilization(gate.utilizationPct);
  const queueLevel: RiskLevel = gate.queueLen >= GATE_QUEUE_CRITICAL ? 'critical' : 'normal';
  const level = maxRiskLevel(utilLevel, queueLevel);
  if (level === 'normal') return null;

  const surplus = gate.inflowPerMin - gate.throughputPerMin;
  const growing = surplus > 0;

  const detail = [
    `${gate.name} is running at ${round1(gate.utilizationPct)}% of processing capacity`,
    ` (${Math.round(gate.inflowPerMin)} arrivals/min against ${Math.round(gate.throughputPerMin)}/min throughput)`,
    ` with ${Math.round(gate.queueLen)} people queueing`,
    growing ? `, and the queue is growing by ${Math.round(surplus)} people/min` : '',
    '.',
  ].join('');

  return {
    id: `gate:${gate.id}`,
    kind: 'gate',
    subjectId: gate.id,
    subjectName: gate.name,
    level,
    detail,
    score: levelScore(level) + (growing ? Math.min(20, surplus / 5) : 0),
  };
}

/**
 * Builds risk entries for degraded transit lines.
 *
 * @param snapshot - The snapshot to read transit state from.
 * @returns Zero or more transit risks.
 */
function assessTransit(snapshot: Snapshot): Risk[] {
  return snapshot.transit
    .filter((line) => line.status !== 'ok')
    .map((line): Risk => {
      const level: RiskLevel =
        line.status === 'down' || line.delayMin >= TRANSIT_DELAY_HIGH_MIN
          ? 'high'
          : line.delayMin >= TRANSIT_DELAY_ELEVATED_MIN
            ? 'elevated'
            : 'normal';

      const sharePct = Math.round(line.arrivalShare * 100);
      const detail =
        line.status === 'down'
          ? `${line.line} is out of service and normally carries ${sharePct}% of arrivals; expect displaced demand at the gates it feeds.`
          : `${line.line} is delayed by ${line.delayMin} min and carries ${sharePct}% of arrivals, concentrating a late-arrival surge.`;

      return {
        id: `transit:${line.line}`,
        kind: 'transit',
        subjectId: line.line,
        subjectName: line.line,
        level,
        detail,
        // A delay on a line carrying most of the crowd matters far more than
        // the same delay on a minor line, so weight by arrival share.
        score: levelScore(level) + Math.round(line.arrivalShare * 20),
      };
    })
    .filter((risk) => risk.level !== 'normal');
}

/**
 * Assesses a snapshot and produces the authoritative situation report.
 *
 * Risks are returned sorted most-urgent first. Ordering is fully deterministic:
 * by score, then by id, so equal-score risks never shuffle between ticks.
 *
 * @param snapshot - The venue state to assess.
 * @param generatedAt - ISO-8601 timestamp to stamp on the report. Passed in
 *   rather than read from the clock so the function stays pure and testable.
 * @returns The situation report.
 */
export function buildSituationReport(snapshot: Snapshot, generatedAt: string): SituationReport {
  const heatStress = isHeatStress(snapshot.weather.tempC, snapshot.weather.humidityPct);

  const risks: Risk[] = [
    ...snapshot.zones.map((zone) => assessZone(zone, heatStress)),
    ...snapshot.gates.map(assessGate),
  ]
    .filter((risk): risk is Risk => risk !== null)
    .concat(assessTransit(snapshot))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const overall = risks.reduce<RiskLevel>((acc, risk) => maxRiskLevel(acc, risk.level), 'normal');

  return { overall, risks, snapshot, generatedAt };
}

/**
 * Recomputes a zone's density percentage from its occupancy and capacity.
 *
 * @param occupancy - People currently in the zone.
 * @param capacity - Safe capacity in people.
 * @returns Density as a percentage; 0 when capacity is non-positive.
 */
export function densityPct(occupancy: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return (occupancy / capacity) * 100;
}

/**
 * Recomputes a gate's utilization percentage.
 *
 * @param inflowPerMin - Arrivals per minute.
 * @param throughputPerMin - Processing capacity per minute.
 * @returns Utilization as a percentage; 0 when throughput is non-positive and
 *   there is no inflow, and 999 when a gate is closed but still receiving
 *   arrivals (an unbounded ratio clamped to a renderable sentinel).
 */
export function utilizationPct(inflowPerMin: number, throughputPerMin: number): number {
  if (throughputPerMin <= 0) return inflowPerMin > 0 ? 999 : 0;
  return (inflowPerMin / throughputPerMin) * 100;
}
