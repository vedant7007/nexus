// Every safety constant in one auditable place: fixed, reviewed, and cited,
// never inferred or model-generated. The /methodology page renders these values
// and sources directly.
//
// Sourcing: bands follow established crowd-density guidance (UK SGSA Green
// Guide; Fruin Level-of-Service). ~4 people/m² is the widely used onset of
// high-risk crowd pressure, which maps to the top of our 'high' band; safe
// zone capacities are set so that 100% density corresponds to that limit.
import type { RiskLevel } from './types';

// Bands as a percentage of *safe* capacity (not fire-code max). 100% is the
// safe design limit (~4 people/m²), where involuntary crowd contact begins.
export const DENSITY_BANDS = {
  elevated: 70,
  high: 85,
  /** Above this, approaching unsafe pressure; intervene immediately. */
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

const LEVEL_ORDER: readonly RiskLevel[] = ['normal', 'elevated', 'high', 'critical'];

export function classifyDensity(densityPct: number): RiskLevel {
  if (densityPct >= DENSITY_BANDS.critical) return 'critical';
  if (densityPct >= DENSITY_BANDS.high) return 'high';
  if (densityPct >= DENSITY_BANDS.elevated) return 'elevated';
  return 'normal';
}

export function classifyGateUtilization(utilizationPct: number): RiskLevel {
  if (utilizationPct >= GATE_UTILIZATION_BANDS.critical) return 'critical';
  if (utilizationPct >= GATE_UTILIZATION_BANDS.high) return 'high';
  if (utilizationPct >= GATE_UTILIZATION_BANDS.elevated) return 'elevated';
  return 'normal';
}

/** Returns the more severe of two risk levels. */
export function maxRiskLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  return LEVEL_ORDER.indexOf(a) >= LEVEL_ORDER.indexOf(b) ? a : b;
}

/** Raises a risk level by one band, saturating at 'critical'. */
export function escalate(level: RiskLevel): RiskLevel {
  const next = LEVEL_ORDER[Math.min(LEVEL_ORDER.indexOf(level) + 1, LEVEL_ORDER.length - 1)];
  // LEVEL_ORDER is a non-empty constant and the index is clamped in range, so
  // this is unreachable; it exists to satisfy noUncheckedIndexedAccess.
  return next ?? 'critical';
}

export function levelScore(level: RiskLevel): number {
  return LEVEL_SCORE[level];
}

/**
 * Reports whether conditions constitute heat stress (crowd risk should escalate).
 *
 * Both temperature and humidity must be elevated: dry heat is far better
 * tolerated by a standing crowd than the same temperature when humid.
 */
export function isHeatStress(tempC: number, humidityPct: number): boolean {
  return tempC >= HEAT_STRESS_TEMP_C && humidityPct >= HEAT_STRESS_HUMIDITY_PCT;
}
