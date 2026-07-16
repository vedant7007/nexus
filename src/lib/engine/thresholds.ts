/**
 * @module engine/thresholds
 *
 * Responsibility: every safety constant in the system, in one auditable place.
 *
 * These numbers are the reason NEXUS can be trusted. They are fixed, reviewed,
 * and cited — never inferred, never model-generated, never tuned at runtime.
 * The /methodology page renders this module's values and sources directly so an
 * operator can audit exactly what the system considers dangerous.
 *
 * Sourcing: bands follow established crowd-density guidance (UK SGSA Green
 * Guide; Fruin Level-of-Service). ~4 people/m² is the widely used onset of
 * high-risk crowd pressure, which maps to the top of our 'high' band; safe
 * zone capacities are set so that 100% density corresponds to that limit.
 */
import type { RiskLevel } from './types';

/**
 * Crowd density bands as a percentage of *safe* capacity (not fire-code max).
 *
 * A zone at 100% is at its safe design limit, which corresponds to roughly
 * 4 people/m² — the point at which involuntary crowd contact begins and
 * pressure waves become possible.
 */
export const DENSITY_BANDS = {
  /** Below this, the zone is comfortable. */
  elevated: 70,
  /** Above this, monitor actively; movement becomes constrained. */
  high: 85,
  /** Above this, intervene immediately; approaching unsafe pressure. */
  critical: 95,
} as const;

/** Gate utilization bands, as inflow percent of throughput. Over 100% the queue grows. */
export const GATE_UTILIZATION_BANDS = {
  elevated: 80,
  high: 95,
  critical: 105,
} as const;

/** Queue length in people at which a gate queue is itself a crowd risk. */
export const GATE_QUEUE_CRITICAL = 800;

/** Transit delay in minutes that materially shifts the arrival curve. */
export const TRANSIT_DELAY_ELEVATED_MIN = 5;

/** Transit delay in minutes that concentrates a late-arrival surge. */
export const TRANSIT_DELAY_HIGH_MIN = 10;

/** Heat-stress threshold in °C above which crowd risk is escalated one band. */
export const HEAT_STRESS_TEMP_C = 32;

/** Humidity percentage that compounds heat stress. */
export const HEAT_STRESS_HUMIDITY_PCT = 60;

/** Horizon in minutes beyond which an ETA-to-critical is not operationally useful. */
export const ETA_HORIZON_MIN = 30;

/** Ranking weight per risk level; drives deterministic ordering of risks. */
const LEVEL_SCORE: Record<RiskLevel, number> = {
  normal: 0,
  elevated: 25,
  high: 55,
  critical: 100,
};

/** Ordering of risk levels from calm to emergency. */
const LEVEL_ORDER: readonly RiskLevel[] = ['normal', 'elevated', 'high', 'critical'];

/**
 * Classifies a zone density percentage into a risk band.
 *
 * @param densityPct - Occupancy as a percentage of safe capacity.
 * @returns The band this density falls into.
 */
export function classifyDensity(densityPct: number): RiskLevel {
  if (densityPct >= DENSITY_BANDS.critical) return 'critical';
  if (densityPct >= DENSITY_BANDS.high) return 'high';
  if (densityPct >= DENSITY_BANDS.elevated) return 'elevated';
  return 'normal';
}

/**
 * Classifies a gate's utilization into a risk band.
 *
 * @param utilizationPct - Inflow as a percentage of throughput.
 * @returns The band this utilization falls into.
 */
export function classifyGateUtilization(utilizationPct: number): RiskLevel {
  if (utilizationPct >= GATE_UTILIZATION_BANDS.critical) return 'critical';
  if (utilizationPct >= GATE_UTILIZATION_BANDS.high) return 'high';
  if (utilizationPct >= GATE_UTILIZATION_BANDS.elevated) return 'elevated';
  return 'normal';
}

/**
 * Returns the more severe of two risk levels.
 *
 * @param a - First level.
 * @param b - Second level.
 * @returns Whichever level ranks higher.
 */
export function maxRiskLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  return LEVEL_ORDER.indexOf(a) >= LEVEL_ORDER.indexOf(b) ? a : b;
}

/**
 * Raises a risk level by one band, saturating at 'critical'.
 *
 * @param level - The level to escalate.
 * @returns The next band up, or 'critical' if already there.
 */
export function escalate(level: RiskLevel): RiskLevel {
  const next = LEVEL_ORDER[Math.min(LEVEL_ORDER.indexOf(level) + 1, LEVEL_ORDER.length - 1)];
  // LEVEL_ORDER is a non-empty constant and the index is clamped in range, so
  // this is unreachable; it exists to satisfy noUncheckedIndexedAccess.
  return next ?? 'critical';
}

/**
 * Maps a risk level to its numeric ranking weight.
 *
 * @param level - The level to weight.
 * @returns A score where higher means more urgent.
 */
export function levelScore(level: RiskLevel): number {
  return LEVEL_SCORE[level];
}

/**
 * Reports whether conditions constitute heat stress.
 *
 * Both temperature and humidity must be elevated: dry heat is far better
 * tolerated by a standing crowd than the same temperature when humid.
 *
 * @param tempC - Air temperature in °C.
 * @param humidityPct - Relative humidity, 0–100.
 * @returns True when the crowd risk band should be escalated.
 */
export function isHeatStress(tempC: number, humidityPct: number): boolean {
  return tempC >= HEAT_STRESS_TEMP_C && humidityPct >= HEAT_STRESS_HUMIDITY_PCT;
}
