import { describe, expect, it } from 'vitest';

import {
  OVERFLOW_LANE_UPLIFT,
  computeCapacityUplift,
  computeRerouteImpact,
  findReliefGate,
  gateMitigations,
  mitigationsFor,
  zoneMitigations,
} from '@/lib/engine/flow';
import { densityPct, utilizationPct } from '@/lib/engine/situation';
import type { GateState, Risk, Snapshot, ZoneState } from '@/lib/engine/types';

function gate(over: Partial<GateState> = {}): GateState {
  const inflow = over.inflowPerMin ?? 100;
  const throughput = over.throughputPerMin ?? 100;
  return {
    id: 'gA',
    name: 'Gate A',
    inflowPerMin: inflow,
    throughputPerMin: throughput,
    queueLen: 0,
    utilizationPct: utilizationPct(inflow, throughput),
    feedsZoneId: 'z1',
    ...over,
  };
}

function zone(over: Partial<ZoneState> = {}): ZoneState {
  const occupancy = over.occupancy ?? 9_400;
  const capacity = over.capacity ?? 10_000;
  return {
    id: 'z1',
    name: 'North Lower',
    occupancy,
    capacity,
    densityPct: densityPct(occupancy, capacity),
    netFlowPerMin: 60,
    ...over,
  };
}

function snapshot(over: Partial<Snapshot> = {}): Snapshot {
  return {
    tMinusKickoffMin: 20,
    tick: 40,
    zones: [zone()],
    gates: [gate()],
    transit: [{ line: 'Metro Blue Line', status: 'delayed', delayMin: 12, arrivalShare: 0.35 }],
    weather: { tempC: 20, condition: 'Clear', humidityPct: 40 },
    resources: {
      energyKwh: 2_400,
      wasteDiversionPct: 75,
      waterLitres: 18_000,
      publicTransportSharePct: 62,
    },
    ...over,
  };
}

describe('computeRerouteImpact', () => {
  const from = gate({
    id: 'gC',
    name: 'Gate C',
    inflowPerMin: 150,
    throughputPerMin: 90,
    queueLen: 600,
  });
  const to = gate({ id: 'gD', name: 'Gate D', inflowPerMin: 46, throughputPerMin: 100 });

  it('moves the requested share of arrivals off the source gate', () => {
    const impact = computeRerouteImpact(from, to, 0.2);

    // 150 - 30 = 120 against 90/min throughput.
    expect(impact.fromBeforePct).toBeCloseTo(166.7, 0);
    expect(impact.fromAfterPct).toBeCloseTo(133.3, 0);
  });

  it('adds exactly that share to the destination gate', () => {
    const impact = computeRerouteImpact(from, to, 0.2);
    // 46 + 30 = 76 against 100/min throughput.
    expect(impact.toAfterPct).toBeCloseTo(76, 0);
  });

  it('conserves people — nothing is created or lost by a reroute', () => {
    const impact = computeRerouteImpact(from, to, 0.2);
    const movedFromSource =
      ((impact.fromBeforePct - impact.fromAfterPct) / 100) * from.throughputPerMin;
    const addedToTarget = ((impact.toAfterPct - impact.toBeforePct) / 100) * to.throughputPerMin;
    // Reported percentages are rounded to 1dp, so allow sub-person tolerance.
    expect(movedFromSource).toBeCloseTo(addedToTarget, 0);
  });

  it('projects a queue clearance time once the gate is under capacity', () => {
    // 150 - 75 = 75 inflow vs 90/min throughput → drains at 15/min on a 600 queue.
    const impact = computeRerouteImpact(from, to, 0.5);
    expect(impact.clearanceMin).toBe(40);
  });

  it('reports a clearance time when the reroute creates real drainage', () => {
    const impact = computeRerouteImpact(from, to, 0.6);
    // 150 - 90 = 60 inflow vs 90 throughput → 30/min drain on a 600 queue.
    expect(impact.clearanceMin).toBe(20);
  });

  it('reports null clearance when the queue never drains', () => {
    const impact = computeRerouteImpact(from, to, 0);
    expect(impact.clearanceMin).toBeNull();
  });

  it('reports zero clearance when there is drainage but no queue', () => {
    const impact = computeRerouteImpact(gate({ inflowPerMin: 50, throughputPerMin: 100 }), to, 0.1);
    expect(impact.clearanceMin).toBe(0);
  });

  it('is a no-op at 0% moved', () => {
    const impact = computeRerouteImpact(from, to, 0);
    expect(impact.fromAfterPct).toBeCloseTo(impact.fromBeforePct, 5);
  });

  it('empties the source gate at 100% moved', () => {
    expect(computeRerouteImpact(from, to, 1).fromAfterPct).toBe(0);
  });

  it.each([-0.1, 1.1, 2])('rejects an out-of-range share (%s)', (pct) => {
    expect(() => computeRerouteImpact(from, to, pct)).toThrow(RangeError);
  });

  it('carries the gate ids through for traceability', () => {
    const impact = computeRerouteImpact(from, to, 0.2);
    expect(impact.fromGateId).toBe('gC');
    expect(impact.toGateId).toBe('gD');
  });
});

describe('computeCapacityUplift', () => {
  it('raises throughput by the uplift and lowers utilization accordingly', () => {
    const result = computeCapacityUplift(gate({ inflowPerMin: 120, throughputPerMin: 100 }), 0.2);

    expect(result.newThroughputPerMin).toBe(120);
    expect(result.beforePct).toBe(120);
    expect(result.afterPct).toBe(100);
  });

  it('is a no-op at zero uplift', () => {
    const result = computeCapacityUplift(gate({ inflowPerMin: 120, throughputPerMin: 100 }), 0);
    expect(result.afterPct).toBe(result.beforePct);
  });

  it('rejects a negative uplift', () => {
    expect(() => computeCapacityUplift(gate(), -0.1)).toThrow(RangeError);
  });
});

describe('findReliefGate', () => {
  const overloaded = gate({ id: 'gC', name: 'Gate C', inflowPerMin: 150, throughputPerMin: 90 });

  it('picks the gate with the most headroom', () => {
    const relief = findReliefGate(overloaded, [
      overloaded,
      gate({ id: 'gD', name: 'Gate D', inflowPerMin: 70, throughputPerMin: 100 }),
      gate({ id: 'gE', name: 'Gate E', inflowPerMin: 30, throughputPerMin: 100 }),
    ]);

    expect(relief?.id).toBe('gE');
  });

  it('never picks the overloaded gate itself', () => {
    expect(findReliefGate(overloaded, [overloaded])).toBeNull();
  });

  it('returns null when every other gate is already busy', () => {
    const relief = findReliefGate(overloaded, [
      overloaded,
      gate({ id: 'gD', inflowPerMin: 95, throughputPerMin: 100 }),
    ]);
    expect(relief).toBeNull();
  });

  it('breaks ties by id, so the choice is stable between ticks', () => {
    const relief = findReliefGate(overloaded, [
      overloaded,
      gate({ id: 'gZ', inflowPerMin: 30, throughputPerMin: 100 }),
      gate({ id: 'gB', inflowPerMin: 30, throughputPerMin: 100 }),
    ]);
    expect(relief?.id).toBe('gB');
  });
});

describe('gateMitigations', () => {
  const overloaded = gate({
    id: 'gC',
    name: 'Gate C',
    inflowPerMin: 110,
    throughputPerMin: 90,
    queueLen: 500,
  });
  const relief = gate({ id: 'gD', name: 'Gate D', inflowPerMin: 46, throughputPerMin: 100 });

  it('always offers at least the capacity levers, which need no other gate', () => {
    const options = gateMitigations(overloaded, [overloaded]);
    expect(options.map((o) => o.id)).toContain(`overflow:${overloaded.id}`);
    expect(options.map((o) => o.id)).toContain(`staff:${overloaded.id}`);
  });

  it('offers a reroute when a relief gate exists', () => {
    const options = gateMitigations(overloaded, [overloaded, relief]);
    expect(options.some((o) => o.id === 'reroute:gC:gD')).toBe(true);
  });

  it('picks the smallest reroute that works, so the response is proportionate', () => {
    const options = gateMitigations(overloaded, [overloaded, relief]);
    const reroute = options.find((o) => o.id === 'reroute:gC:gD');
    // Gate C is at 122%. Steps of 10/15/20% leave it at 110/104/98% — all still
    // over the 95% high band — so 30% is the smallest step that actually works.
    expect(reroute?.action).toContain('30%');
  });

  it('quantifies every option with real before/after numbers', () => {
    for (const option of gateMitigations(overloaded, [overloaded, relief])) {
      expect(option.impact).toMatch(/\d/);
      expect(option.impact).toContain('→');
    }
  });

  it('names the overflow uplift consistently with the constant', () => {
    const option = gateMitigations(overloaded, [overloaded]).find((o) => o.id === 'overflow:gC');
    const expected = Math.round(overloaded.throughputPerMin * (1 + OVERFLOW_LANE_UPLIFT));
    expect(option?.impact).toContain(String(expected));
  });

  it('orders options most-effective first', () => {
    const options = gateMitigations(overloaded, [overloaded, relief]);
    const scores = options.map((o) => o.effectiveness);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('is deterministic', () => {
    expect(gateMitigations(overloaded, [overloaded, relief])).toEqual(
      gateMitigations(overloaded, [overloaded, relief]),
    );
  });
});

describe('zoneMitigations', () => {
  const risk: Risk = {
    id: 'crowd:z1',
    kind: 'crowd',
    subjectId: 'z1',
    subjectName: 'North Lower',
    level: 'critical',
    detail: '',
    score: 100,
  };

  it('offers metering when gates feed the zone', () => {
    const options = zoneMitigations(risk, snapshot());
    expect(options.some((o) => o.id === 'meter:z1')).toBe(true);
  });

  it('always offers dispersal, which needs no gate', () => {
    const options = zoneMitigations(risk, snapshot({ gates: [] }));
    expect(options.map((o) => o.id)).toEqual(['disperse:z1']);
  });

  it('returns nothing for a zone that is not in the snapshot', () => {
    expect(zoneMitigations({ ...risk, subjectId: 'nope' }, snapshot())).toEqual([]);
  });

  it('cites the zone density in the dispersal impact', () => {
    const option = zoneMitigations(risk, snapshot()).find((o) => o.id === 'disperse:z1');
    expect(option?.impact).toContain('94%');
  });
});

describe('mitigationsFor', () => {
  it('dispatches gate risks to the gate model', () => {
    const risk: Risk = {
      id: 'gate:gA',
      kind: 'gate',
      subjectId: 'gA',
      subjectName: 'Gate A',
      level: 'high',
      detail: '',
      score: 55,
    };
    expect(mitigationsFor(risk, snapshot()).length).toBeGreaterThan(0);
  });

  it('returns nothing for a gate that has vanished from the snapshot', () => {
    const risk: Risk = {
      id: 'gate:gone',
      kind: 'gate',
      subjectId: 'gone',
      subjectName: 'Gone',
      level: 'high',
      detail: '',
      score: 55,
    };
    expect(mitigationsFor(risk, snapshot())).toEqual([]);
  });

  it('produces a comms action for a transit risk', () => {
    const risk: Risk = {
      id: 'transit:Metro Blue Line',
      kind: 'transit',
      subjectId: 'Metro Blue Line',
      subjectName: 'Metro Blue Line',
      level: 'high',
      detail: '',
      score: 62,
    };

    const options = mitigationsFor(risk, snapshot());
    expect(options[0]?.action).toContain('advisory');
    expect(options[0]?.impact).toContain('35%');
  });

  it('returns nothing for a transit line that has vanished', () => {
    const risk: Risk = {
      id: 'transit:ghost',
      kind: 'transit',
      subjectId: 'ghost',
      subjectName: 'ghost',
      level: 'high',
      detail: '',
      score: 55,
    };
    expect(mitigationsFor(risk, snapshot())).toEqual([]);
  });
});
