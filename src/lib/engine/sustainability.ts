// As everywhere in the engine, the numbers and factual drivers are computed
// here; the AI layer only rephrases them.
import type { Resources, Snapshot, SustainabilitySummary } from './types';

/** Matchday baselines for a full house at this venue. */
export const BASELINE: Resources = {
  /** Typical draw per tick for a sold-out match. */
  energyKwh: 2_400,
  /** Venue sustainability target for waste diverted from landfill. */
  wasteDiversionPct: 75,
  waterLitres: 18_000,
  /** Venue target for spectators arriving by public transport. */
  publicTransportSharePct: 60,
};

/** Energy overshoot, in percent, that is worth flagging to the control room. */
export const ENERGY_ALERT_DELTA_PCT = 5;

/**
 * Summarises the venue's resource position against the matchday baseline,
 * as computed deltas plus factual drivers with no generated language.
 */
export function sustainabilitySummary(
  snapshot: Snapshot,
  baseline: Resources = BASELINE,
): SustainabilitySummary {
  const { resources } = snapshot;

  const energyDeltaPct =
    baseline.energyKwh <= 0
      ? 0
      : Math.round(((resources.energyKwh - baseline.energyKwh) / baseline.energyKwh) * 1000) / 10;

  const drivers: string[] = [];

  if (energyDeltaPct >= ENERGY_ALERT_DELTA_PCT) {
    // Attribute the overshoot to the busiest zones: HVAC and lighting load
    // track occupancy closely, so the densest zones are the honest explanation.
    const busiest = [...snapshot.zones]
      .sort((a, b) => b.densityPct - a.densityPct)
      .slice(0, 2)
      .map((z) => z.name);
    drivers.push(
      `Energy draw is ${energyDeltaPct}% above the matchday baseline, tracking peak occupancy in ${busiest.join(' and ')}.`,
    );
  } else if (energyDeltaPct <= -ENERGY_ALERT_DELTA_PCT) {
    drivers.push(`Energy draw is ${Math.abs(energyDeltaPct)}% below the matchday baseline.`);
  } else {
    drivers.push(`Energy draw is within ${ENERGY_ALERT_DELTA_PCT}% of the matchday baseline.`);
  }

  if (resources.wasteDiversionPct < baseline.wasteDiversionPct) {
    drivers.push(
      `Waste diversion is ${Math.round(resources.wasteDiversionPct)}%, below the ${baseline.wasteDiversionPct}% target.`,
    );
  } else {
    drivers.push(
      `Waste diversion is ${Math.round(resources.wasteDiversionPct)}%, meeting the ${baseline.wasteDiversionPct}% target.`,
    );
  }

  if (resources.publicTransportSharePct >= baseline.publicTransportSharePct) {
    drivers.push(
      `Public transport modal share is ${Math.round(resources.publicTransportSharePct)}%, at or above the ${baseline.publicTransportSharePct}% target.`,
    );
  } else {
    drivers.push(
      `Public transport modal share is ${Math.round(resources.publicTransportSharePct)}%, below the ${baseline.publicTransportSharePct}% target.`,
    );
  }

  const onTarget =
    energyDeltaPct < ENERGY_ALERT_DELTA_PCT &&
    resources.wasteDiversionPct >= baseline.wasteDiversionPct &&
    resources.publicTransportSharePct >= baseline.publicTransportSharePct;

  return {
    energyKwh: Math.round(resources.energyKwh),
    energyDeltaPct,
    wasteDiversionPct: Math.round(resources.wasteDiversionPct),
    waterLitres: Math.round(resources.waterLitres),
    publicTransportSharePct: Math.round(resources.publicTransportSharePct),
    drivers,
    onTarget,
  };
}
