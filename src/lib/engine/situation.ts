// Turns a raw Snapshot into the authoritative SituationReport: the deterministic
// pre-pass everything else depends on (UI, AI ground truth, fallbacks). A pure
// function of its inputs — same snapshot in, same report out, no clock, no I/O.
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

// Rounds to one decimal place, avoiding float noise in rendered output.
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Formats a headcount with thousands separators. An operator scanning a briefing
 * under pressure reads "6,611" instantly but has to count digits on "6611".
 */
export function formatCount(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/**
 * Projects minutes until a zone reaches critical density at its current rate.
 * Undefined when flat, improving, already critical, or beyond the planning horizon.
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

// Builds the risk entry for a zone, or null when its density is normal.
function assessZone(zone: ZoneState, heatStress: boolean): Risk | null {
  const base = classifyDensity(zone.densityPct);
  if (base === 'normal') return null;

  // Heat compounds crowd pressure: the same density is materially more
  // dangerous when a standing crowd cannot shed heat, so escalate one band.
  const level = heatStress ? escalate(base) : base;
  const eta = etaToCriticalMin(zone);

  const detail = [
    `${zone.name} is at ${round1(zone.densityPct)}% of safe capacity `,
    `(${formatCount(zone.occupancy)} of ${formatCount(zone.capacity)} people)`,
    eta === undefined ? '' : `, and is on track to reach critical in about ${eta} minutes`,
    heatStress ? '. Heat and humidity raise this by one band' : '',
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

// Builds the risk entry for a gate, or null when utilization and queue are both normal.
function assessGate(gate: GateState): Risk | null {
  const utilLevel = classifyGateUtilization(gate.utilizationPct);
  const queueLevel: RiskLevel = gate.queueLen >= GATE_QUEUE_CRITICAL ? 'critical' : 'normal';
  const level = maxRiskLevel(utilLevel, queueLevel);
  if (level === 'normal') return null;

  const surplus = gate.inflowPerMin - gate.throughputPerMin;
  const growing = surplus > 0;

  const detail = [
    `${gate.name} is taking ${formatCount(gate.inflowPerMin)} arrivals a minute `,
    `but can only process ${formatCount(gate.throughputPerMin)}, `,
    `putting it at ${round1(gate.utilizationPct)}% of capacity `,
    `with ${formatCount(gate.queueLen)} people waiting`,
    growing ? `. The queue is growing by ${formatCount(surplus)} people a minute` : '',
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

// Builds risk entries for degraded transit lines.
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
 * `generatedAt` (ISO-8601) is passed in rather than read from the clock so the
 * function stays pure and testable.
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

/** Density as a percentage of safe capacity; 0 when capacity is non-positive. */
export function densityPct(occupancy: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return (occupancy / capacity) * 100;
}

/**
 * Utilization as a percentage. 0 when throughput is non-positive with no inflow;
 * 999 when a gate is closed but still receiving arrivals (an unbounded ratio
 * clamped to a renderable sentinel).
 */
export function utilizationPct(inflowPerMin: number, throughputPerMin: number): number {
  if (throughputPerMin <= 0) return inflowPerMin > 0 ? 999 : 0;
  return (inflowPerMin / throughputPerMin) * 100;
}
