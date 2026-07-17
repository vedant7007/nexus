import { describe, expect, it } from 'vitest';

import { buildSituationReport } from '@/lib/engine/situation';
import { SCENARIOS, SCENARIO_IDS, getScenario, isScenarioId } from '@/lib/sim/scenarios';
import {
  MAX_TICK,
  START_T_MINUS_MIN,
  arrivalRatePerMin,
  resolveGateShares,
  seededNoise,
  simulate,
  tickForElapsed,
} from '@/lib/sim/simulator';
import {
  FED_CAPACITY,
  GATES,
  TRANSIT_SHARE,
  UNFED_CAPACITY,
  VENUE_CAPACITY,
  ZONES,
  isGateFedZone,
  nearestFirstAid,
  zoneName,
} from '@/lib/sim/venue';

const AT = '2026-06-14T18:00:00.000Z';

describe('venue configuration', () => {
  it('has the documented 8 zones and 6 gates', () => {
    expect(ZONES).toHaveLength(8);
    expect(GATES).toHaveLength(6);
  });

  it('zone capacities sum to the stated venue capacity', () => {
    expect(ZONES.reduce((sum, z) => sum + z.capacity, 0)).toBe(VENUE_CAPACITY);
  });

  it('gate arrival shares sum to 1, so no arrivals are lost or invented', () => {
    expect(GATES.reduce((sum, g) => sum + g.arrivalShare, 0)).toBeCloseTo(1, 5);
  });

  it('every gate feeds a real zone', () => {
    const zoneIds = new Set(ZONES.map((z) => z.id));
    for (const gate of GATES) expect(zoneIds.has(gate.feedsZoneId)).toBe(true);
  });

  it('every zone has a unique id', () => {
    expect(new Set(ZONES.map((z) => z.id)).size).toBe(ZONES.length);
  });

  it('resolves the nearest first-aid point for a zone', () => {
    expect(nearestFirstAid('z3')).toBe('fa-east');
  });

  it('falls back to a real first-aid post for an unknown zone', () => {
    // Routing a responder somewhere real always beats failing the lookup.
    expect(nearestFirstAid('does-not-exist')).toBe('fa-north');
  });

  it('resolves zone display names, falling back to the id', () => {
    expect(zoneName('z1')).toBe('North Lower');
    expect(zoneName('unknown')).toBe('unknown');
  });

  it('knows which zones are entered through a gate', () => {
    expect(isGateFedZone('z1')).toBe(true);
    expect(isGateFedZone('z3')).toBe(true);
    // Upper tiers and far stands are reached only on foot from a concourse.
    expect(isGateFedZone('z6')).toBe(false);
    expect(isGateFedZone('z8')).toBe(false);
    expect(isGateFedZone('nope')).toBe(false);
  });

  it('splits capacity between gate-fed and circulation-only zones', () => {
    expect(FED_CAPACITY + UNFED_CAPACITY).toBe(VENUE_CAPACITY);
    expect(UNFED_CAPACITY).toBeGreaterThan(0);
  });

  it('derives the walk-on share from capacity rather than tuning it', () => {
    expect(TRANSIT_SHARE).toBeCloseTo(UNFED_CAPACITY / VENUE_CAPACITY, 10);
    expect(TRANSIT_SHARE).toBeGreaterThan(0);
    expect(TRANSIT_SHARE).toBeLessThan(1);
  });

  it('sizes total gate throughput with headroom over the peak arrival rate', () => {
    // The property that keeps a normal rush out of the 'critical' band.
    const totalThroughput = GATES.reduce((sum, g) => sum + g.baseThroughputPerMin, 0);
    expect(totalThroughput).toBeGreaterThan(arrivalRatePerMin(22) * 1.05);
  });
});

describe('scenarios', () => {
  it('exposes every scenario id', () => {
    expect(SCENARIO_IDS).toHaveLength(5);
    for (const id of SCENARIO_IDS) expect(getScenario(id).id).toBe(id);
  });

  it('narrows a valid scenario id', () => {
    expect(isScenarioId('gate_surge')).toBe(true);
  });

  it('rejects an unknown scenario id, so a query param cannot inject one', () => {
    expect(isScenarioId('__proto__')).toBe(false);
    expect(isScenarioId('nonsense')).toBe(false);
  });

  it('gives every scenario a name and description for the picker', () => {
    for (const id of SCENARIO_IDS) {
      expect(getScenario(id).name.length).toBeGreaterThan(0);
      expect(getScenario(id).description.length).toBeGreaterThan(0);
    }
  });

  it('leaves the baseline scenario entirely unmodified', () => {
    const normal = getScenario('normal');
    expect(normal.peakShiftMin).toBe(0);
    expect(normal.spreadScale).toBe(1);
    expect(Object.keys(normal.gateArrivalMultipliers)).toEqual([]);
    expect(Object.keys(normal.gateThroughputMultipliers)).toEqual([]);
    expect(Object.keys(normal.transitDelays)).toEqual([]);
  });

  it('models a transit delay as a later, sharper arrival curve', () => {
    const delay = getScenario('transit_delay');
    expect(delay.peakShiftMin).toBeLessThan(0);
    expect(delay.spreadScale).toBeLessThan(1);
    expect(delay.transitDelays['Metro Blue Line']).toBe(12);
  });

  it('is frozen, so a request cannot mutate scenario config for everyone else', () => {
    // Scenarios are module-level shared state on a multi-tenant server.
    expect(Object.isFrozen(SCENARIOS)).toBe(true);
  });
});

describe('seededNoise', () => {
  it('is deterministic for the same coordinates', () => {
    expect(seededNoise(1337, 5, 2)).toBe(seededNoise(1337, 5, 2));
  });

  it('varies across ticks, subjects, and seeds', () => {
    expect(seededNoise(1337, 5, 2)).not.toBe(seededNoise(1337, 6, 2));
    expect(seededNoise(1337, 5, 2)).not.toBe(seededNoise(1337, 5, 3));
    expect(seededNoise(1337, 5, 2)).not.toBe(seededNoise(99, 5, 2));
  });

  it('stays within [0, 1)', () => {
    for (let tick = 0; tick < 200; tick += 1) {
      const value = seededNoise(1337, tick, tick % 7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('arrivalRatePerMin', () => {
  it('peaks before kickoff rather than at it', () => {
    expect(arrivalRatePerMin(22)).toBeGreaterThan(arrivalRatePerMin(0));
    expect(arrivalRatePerMin(22)).toBeGreaterThan(arrivalRatePerMin(60));
  });

  it('is near zero long before the gates get busy', () => {
    expect(arrivalRatePerMin(90)).toBeLessThan(arrivalRatePerMin(40));
  });

  it('is never negative', () => {
    for (let t = -30; t <= 90; t += 5) expect(arrivalRatePerMin(t)).toBeGreaterThanOrEqual(0);
  });
});

describe('tickForElapsed', () => {
  it('advances one tick per interval', () => {
    expect(tickForElapsed(0, 0)).toBe(0);
    expect(tickForElapsed(0, 3_000)).toBe(1);
    expect(tickForElapsed(0, 9_000)).toBe(3);
  });

  it('honours a custom interval', () => {
    expect(tickForElapsed(0, 10_000, 1_000)).toBe(10);
  });

  it('clamps to the simulation window rather than running off the end', () => {
    expect(tickForElapsed(0, 999_999_999)).toBe(MAX_TICK);
  });

  it('never returns a negative tick for a clock skewed backwards', () => {
    expect(tickForElapsed(10_000, 0)).toBe(0);
  });
});

describe('simulate — determinism', () => {
  it('produces an identical snapshot for the same seed and tick', () => {
    expect(simulate('normal', 40)).toEqual(simulate('normal', 40));
  });

  it('produces a different snapshot for a different seed', () => {
    expect(simulate('normal', 40, 1)).not.toEqual(simulate('normal', 40, 2));
  });

  it('reproduces a whole run identically — the demo is repeatable', () => {
    const runA = Array.from({ length: 20 }, (_, i) => simulate('gate_surge', i * 4));
    const runB = Array.from({ length: 20 }, (_, i) => simulate('gate_surge', i * 4));
    expect(runA).toEqual(runB);
  });

  it('clamps ticks to the simulation window', () => {
    expect(simulate('normal', -10).tick).toBe(0);
    expect(simulate('normal', MAX_TICK + 50).tick).toBe(MAX_TICK);
  });

  it('truncates a fractional tick', () => {
    expect(simulate('normal', 12.9).tick).toBe(12);
  });
});

describe('simulate — physical plausibility', () => {
  const snap = simulate('normal', 60);

  it('counts down to kickoff from the documented start', () => {
    expect(simulate('normal', 0).tMinusKickoffMin).toBe(START_T_MINUS_MIN);
    expect(simulate('normal', 60).tMinusKickoffMin).toBe(0);
  });

  it('includes every zone and gate', () => {
    expect(snap.zones).toHaveLength(ZONES.length);
    expect(snap.gates).toHaveLength(GATES.length);
  });

  it('never reports negative occupancy or queues', () => {
    for (let tick = 0; tick <= MAX_TICK; tick += 5) {
      const s = simulate('gate_surge', tick);
      for (const zone of s.zones) expect(zone.occupancy).toBeGreaterThanOrEqual(0);
      for (const gate of s.gates) expect(gate.queueLen).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps zone density consistent with occupancy and capacity', () => {
    for (const zone of snap.zones) {
      expect(zone.densityPct).toBeCloseTo((zone.occupancy / zone.capacity) * 100, 5);
    }
  });

  it('keeps gate utilization consistent with inflow and throughput', () => {
    for (const gate of snap.gates) {
      expect(gate.utilizationPct).toBeCloseTo((gate.inflowPerMin / gate.throughputPerMin) * 100, 5);
    }
  });

  it('fills the venue over time rather than starting full', () => {
    const early = simulate('normal', 2).zones.reduce((s, z) => s + z.occupancy, 0);
    const late = simulate('normal', 60).zones.reduce((s, z) => s + z.occupancy, 0);

    expect(early).toBeLessThan(late);
    expect(late).toBeGreaterThan(0);
  });

  it('never exceeds the venue capacity by more than the modelled overspill margin', () => {
    for (let tick = 0; tick <= MAX_TICK; tick += 10) {
      for (const zone of simulate('normal', tick).zones) {
        expect(zone.occupancy).toBeLessThanOrEqual(zone.capacity * 1.05 + 1);
      }
    }
  });

  it('scales energy with occupancy', () => {
    expect(simulate('normal', 5).resources.energyKwh).toBeLessThan(
      simulate('normal', 60).resources.energyKwh,
    );
  });

  it('keeps resource telemetry in a plausible range', () => {
    for (let tick = 0; tick <= MAX_TICK; tick += 10) {
      const { resources } = simulate('normal', tick);
      expect(resources.wasteDiversionPct).toBeGreaterThan(60);
      expect(resources.wasteDiversionPct).toBeLessThan(85);
      expect(resources.publicTransportSharePct).toBeGreaterThan(50);
      expect(resources.energyKwh).toBeGreaterThan(0);
      expect(resources.waterLitres).toBeGreaterThan(0);
    }
  });
});

/**
 * The scenario picker is the demo's centrepiece: a judge selects a crisis and
 * watches the engine detect it. These tests assert each scenario genuinely
 * reaches the stress state it advertises — the risk is *detected*, not scripted.
 */
describe('simulate — scenarios reach their intended stress state', () => {
  /** Worst risk level the engine detects across a scenario's whole run. */
  function worstLevel(scenario: Parameters<typeof simulate>[0]): string {
    const levels = ['normal', 'elevated', 'high', 'critical'];
    let worst = 0;
    for (let tick = 0; tick <= MAX_TICK; tick += 2) {
      const report = buildSituationReport(simulate(scenario, tick), AT);
      worst = Math.max(worst, levels.indexOf(report.overall));
    }
    return levels[worst] ?? 'normal';
  }

  it('gate_surge drives Gate C to a critical, detected risk', () => {
    const found = Array.from({ length: 46 }, (_, i) => simulate('gate_surge', i * 2))
      .flatMap((snap) => buildSituationReport(snap, AT).risks)
      .some((risk) => risk.kind === 'gate' && risk.subjectId === 'gC' && risk.level === 'critical');

    expect(found).toBe(true);
  });

  it('gate_surge is materially worse at Gate C than a normal matchday', () => {
    const normal = simulate('normal', 40).gates.find((g) => g.id === 'gC');
    const surge = simulate('gate_surge', 40).gates.find((g) => g.id === 'gC');

    expect(surge?.utilizationPct ?? 0).toBeGreaterThan((normal?.utilizationPct ?? 0) * 1.5);
    expect(surge?.queueLen ?? 0).toBeGreaterThan(normal?.queueLen ?? 0);
  });

  it('transit_delay surfaces a detected transit risk naming the delayed line', () => {
    const risks = buildSituationReport(simulate('transit_delay', 30), AT).risks;
    const transit = risks.find((r) => r.kind === 'transit');

    expect(transit?.subjectId).toBe('Metro Blue Line');
    expect(transit?.level).toBe('high');
  });

  it('heat_wave escalates crowd risk above the same density on a normal day', () => {
    const hot = buildSituationReport(simulate('heat_wave', 75), AT);
    expect(
      hot.risks.some((r) => r.detail.includes('Heat and humidity raise this by one band')),
    ).toBe(true);
  });

  it('heat_wave raises energy draw well above a normal matchday', () => {
    expect(simulate('heat_wave', 60).resources.energyKwh).toBeGreaterThan(
      simulate('normal', 60).resources.energyKwh * 1.15,
    );
  });

  it('medical_incident degrades Gate C without making it the worst case', () => {
    const medical = simulate('medical_incident', 40).gates.find((g) => g.id === 'gC');
    const surge = simulate('gate_surge', 40).gates.find((g) => g.id === 'gC');

    expect(medical?.utilizationPct ?? 0).toBeLessThan(surge?.utilizationPct ?? 0);
  });

  it('every crisis scenario reaches at least a high risk somewhere in its run', () => {
    for (const id of ['gate_surge', 'transit_delay', 'heat_wave'] as const) {
      expect(['high', 'critical']).toContain(worstLevel(id));
    }
  });

  it('a normal matchday still gets busy — the engine is not simply silent', () => {
    // Guards the inverse failure: a simulator so tame that nothing is ever
    // detected would make the whole product look like it works when it does not.
    expect(worstLevel('normal')).not.toBe('normal');
  });

  it('a normal matchday never reaches critical — the alarm means something', () => {
    // The complement of the test above, and the more important half. If an
    // ordinary matchday reads 'critical', the status pill is decoration and an
    // operator learns to ignore it. Critical must be earned by a real crisis.
    expect(worstLevel('normal')).toBe('high');
  });
});

/**
 * Conservation of people. The simulator must never create or destroy
 * spectators: a dashboard that quietly invents 5,000 people is worse than one
 * that shows nothing, because it looks authoritative while being wrong.
 */
describe('simulate — conservation of people', () => {
  it('renormalises gate shares to 1 under every scenario', () => {
    for (const id of SCENARIO_IDS) {
      const resolved = resolveGateShares(getScenario(id));
      expect(resolved.reduce((sum, r) => sum + r.share, 0)).toBeCloseTo(1, 6);
    }
  });

  it('redistributes rather than adds when a scenario surges one gate', () => {
    const shareOfC = (id: Parameters<typeof getScenario>[0]): number =>
      resolveGateShares(getScenario(id)).find((r) => r.gate.id === 'gC')?.share ?? 0;

    // Gate C takes a bigger slice...
    expect(shareOfC('gate_surge')).toBeGreaterThan(shareOfC('normal'));
    // ...of exactly the same pie.
    const total = resolveGateShares(getScenario('gate_surge')).reduce((s, r) => s + r.share, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('applies a scenario throughput penalty to the right gate only', () => {
    const resolved = resolveGateShares(getScenario('gate_surge'));
    const gateC = resolved.find((r) => r.gate.id === 'gC');
    const gateA = resolved.find((r) => r.gate.id === 'gA');

    expect(gateC?.throughputPerMin).toBeCloseTo((gateC?.gate.baseThroughputPerMin ?? 0) * 0.85, 5);
    expect(gateA?.throughputPerMin).toBe(gateA?.gate.baseThroughputPerMin);
  });

  it('degrades gracefully to zero shares if every gate were closed', () => {
    const closed = {
      ...getScenario('normal'),
      gateArrivalMultipliers: { gA: 0, gB: 0, gC: 0, gD: 0, gE: 0, gF: 0 },
    };
    expect(resolveGateShares(closed).every((r) => r.share === 0)).toBe(true);
  });

  it('holds total attendance constant when a scenario shifts the arrival curve', () => {
    // Integrate both curves over the window; a transit delay moves the crowd in
    // time, it does not change how many people own tickets.
    const integrate = (shift: number, scale: number): number => {
      let total = 0;
      for (let t = -60; t <= 120; t += 1) total += arrivalRatePerMin(t, shift, scale);
      return total;
    };

    expect(integrate(-12, 0.7)).toBeCloseTo(integrate(0, 1), -2);
  });

  it('compresses the same crowd into a sharper peak when spread narrows', () => {
    const wide = arrivalRatePerMin(22, 0, 1);
    const narrow = arrivalRatePerMin(22, 0, 0.7);
    expect(narrow).toBeGreaterThan(wide);
  });

  it('accounts for every admitted spectator across the zones', () => {
    for (const id of SCENARIO_IDS) {
      const snap = simulate(id, 70);
      const inZones = snap.zones.reduce((sum, z) => sum + z.occupancy, 0);

      // Occupancy carries ±3% sensor jitter and an overspill cap, so compare
      // against the venue rather than demanding exactness.
      expect(inZones).toBeGreaterThan(0);
      expect(inZones).toBeLessThanOrEqual(VENUE_CAPACITY * 1.05);
    }
  });

  it('fills a normal matchday to a realistic share of the venue by kickoff', () => {
    const atKickoff = simulate('normal', 60).zones.reduce((sum, z) => sum + z.occupancy, 0);
    const fillPct = (atKickoff / VENUE_CAPACITY) * 100;

    // A real 80k stadium is most of the way full when the whistle goes.
    expect(fillPct).toBeGreaterThan(70);
    expect(fillPct).toBeLessThan(100);
  });

  it('leaves people stuck outside when a gate cannot cope', () => {
    // The whole point of the gate_surge scenario: a bottleneck means fans are
    // still queueing at kickoff, and the fill rate shows it.
    const surge = simulate('gate_surge', 60);
    const normal = simulate('normal', 60);

    const surgeInside = surge.zones.reduce((sum, z) => sum + z.occupancy, 0);
    const normalInside = normal.zones.reduce((sum, z) => sum + z.occupancy, 0);
    const stuck = surge.gates.reduce((sum, g) => sum + g.queueLen, 0);

    expect(surgeInside).toBeLessThan(normalInside);
    expect(stuck).toBeGreaterThan(2_000);
  });
});
