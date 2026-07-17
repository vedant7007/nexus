import { describe, expect, it } from 'vitest';

import {
  buildSituationReport,
  densityPct,
  etaToCriticalMin,
  utilizationPct,
} from '@/lib/engine/situation';
import {
  classifyDensity,
  classifyGateUtilization,
  escalate,
  isHeatStress,
  levelScore,
  maxRiskLevel,
} from '@/lib/engine/thresholds';
import type { GateState, Snapshot, ZoneState } from '@/lib/engine/types';

const AT = '2026-06-14T18:00:00.000Z';

function zone(over: Partial<ZoneState> = {}): ZoneState {
  const occupancy = over.occupancy ?? 5_000;
  const capacity = over.capacity ?? 10_000;
  return {
    id: 'z1',
    name: 'North Lower',
    occupancy,
    capacity,
    densityPct: densityPct(occupancy, capacity),
    netFlowPerMin: 0,
    ...over,
  };
}

function gate(over: Partial<GateState> = {}): GateState {
  const inflow = over.inflowPerMin ?? 50;
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

function snapshot(over: Partial<Snapshot> = {}): Snapshot {
  return {
    tMinusKickoffMin: 30,
    tick: 30,
    zones: [zone()],
    gates: [gate()],
    transit: [{ line: 'Metro Blue Line', status: 'ok', delayMin: 0, arrivalShare: 0.35 }],
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

describe('densityPct', () => {
  it('computes occupancy as a share of capacity', () => {
    expect(densityPct(5_000, 10_000)).toBe(50);
  });

  it('returns 0 for non-positive capacity rather than dividing by zero', () => {
    expect(densityPct(100, 0)).toBe(0);
    expect(densityPct(100, -5)).toBe(0);
  });

  it('reports over-capacity honestly rather than clamping', () => {
    expect(densityPct(11_000, 10_000)).toBeCloseTo(110);
  });
});

describe('utilizationPct', () => {
  it('computes inflow as a share of throughput', () => {
    expect(utilizationPct(80, 100)).toBe(80);
  });

  it('returns 0 for a closed gate with no arrivals', () => {
    expect(utilizationPct(0, 0)).toBe(0);
  });

  it('returns a sentinel for a closed gate that is still receiving arrivals', () => {
    expect(utilizationPct(50, 0)).toBe(999);
  });
});

describe('threshold classification', () => {
  it.each([
    [50, 'normal'],
    [69.9, 'normal'],
    [70, 'elevated'],
    [84.9, 'elevated'],
    [85, 'high'],
    [94.9, 'high'],
    [95, 'critical'],
    [120, 'critical'],
  ] as const)('classifies %s%% density as %s', (pct, expected) => {
    expect(classifyDensity(pct)).toBe(expected);
  });

  it.each([
    [50, 'normal'],
    [80, 'elevated'],
    [95, 'high'],
    [105, 'critical'],
    [999, 'critical'],
  ] as const)('classifies %s%% gate utilization as %s', (pct, expected) => {
    expect(classifyGateUtilization(pct)).toBe(expected);
  });
});

describe('maxRiskLevel / escalate / levelScore', () => {
  it('returns the more severe level', () => {
    expect(maxRiskLevel('normal', 'high')).toBe('high');
    expect(maxRiskLevel('critical', 'elevated')).toBe('critical');
    expect(maxRiskLevel('elevated', 'elevated')).toBe('elevated');
  });

  it('escalates one band at a time', () => {
    expect(escalate('normal')).toBe('elevated');
    expect(escalate('elevated')).toBe('high');
    expect(escalate('high')).toBe('critical');
  });

  it('saturates at critical', () => {
    expect(escalate('critical')).toBe('critical');
  });

  it('orders levels by score', () => {
    expect(levelScore('critical')).toBeGreaterThan(levelScore('high'));
    expect(levelScore('high')).toBeGreaterThan(levelScore('elevated'));
    expect(levelScore('elevated')).toBeGreaterThan(levelScore('normal'));
  });
});

describe('isHeatStress', () => {
  it('requires both heat and humidity, since dry heat is better tolerated', () => {
    expect(isHeatStress(36, 68)).toBe(true);
    expect(isHeatStress(36, 30)).toBe(false);
    expect(isHeatStress(24, 80)).toBe(false);
  });

  it('fires exactly at the documented boundary', () => {
    expect(isHeatStress(32, 60)).toBe(true);
    expect(isHeatStress(31.9, 60)).toBe(false);
  });
});

describe('etaToCriticalMin', () => {
  it('projects time to critical from the current net flow', () => {
    // 9,000 of 10,000; critical at 9,500; +100/min → 5 minutes.
    const eta = etaToCriticalMin(zone({ occupancy: 9_000, capacity: 10_000, netFlowPerMin: 100 }));
    expect(eta).toBe(5);
  });

  it('returns undefined for a flat or emptying zone', () => {
    expect(etaToCriticalMin(zone({ netFlowPerMin: 0 }))).toBeUndefined();
    expect(etaToCriticalMin(zone({ netFlowPerMin: -50 }))).toBeUndefined();
  });

  it('returns undefined for a zone already at critical', () => {
    expect(
      etaToCriticalMin(zone({ occupancy: 9_800, capacity: 10_000, netFlowPerMin: 100 })),
    ).toBeUndefined();
  });

  it('returns undefined beyond the useful planning horizon', () => {
    // 1 person/min to cover 4,500 people is ~4,500 minutes — not actionable.
    expect(
      etaToCriticalMin(zone({ occupancy: 5_000, capacity: 10_000, netFlowPerMin: 1 })),
    ).toBeUndefined();
  });

  it('returns undefined for a zone with no capacity', () => {
    expect(etaToCriticalMin(zone({ capacity: 0, netFlowPerMin: 10 }))).toBeUndefined();
  });

  it('never reports less than a minute, since sub-minute precision is false comfort', () => {
    const eta = etaToCriticalMin(zone({ occupancy: 9_499, capacity: 10_000, netFlowPerMin: 500 }));
    expect(eta).toBe(1);
  });
});

describe('buildSituationReport', () => {
  it('reports normal with no risks for a calm venue', () => {
    const report = buildSituationReport(snapshot(), AT);
    expect(report.overall).toBe('normal');
    expect(report.risks).toEqual([]);
    expect(report.generatedAt).toBe(AT);
  });

  it('is pure — the same snapshot yields an identical report', () => {
    const snap = snapshot();
    expect(buildSituationReport(snap, AT)).toEqual(buildSituationReport(snap, AT));
  });

  it('flags a zone over the elevated threshold', () => {
    const report = buildSituationReport(
      snapshot({ zones: [zone({ occupancy: 8_000, capacity: 10_000 })] }),
      AT,
    );

    expect(report.overall).toBe('elevated');
    expect(report.risks).toHaveLength(1);
    expect(report.risks[0]?.kind).toBe('crowd');
    expect(report.risks[0]?.id).toBe('crowd:z1');
  });

  it('states real numbers in the risk detail, so the AI has facts to cite', () => {
    const report = buildSituationReport(
      snapshot({ zones: [zone({ occupancy: 9_600, capacity: 10_000 })] }),
      AT,
    );

    expect(report.risks[0]?.detail).toContain('96%');
    // Thousands separators: an operator reads '9,600' at a glance.
    expect(report.risks[0]?.detail).toContain('9,600');
    expect(report.risks[0]?.detail).toContain('10,000');
  });

  it('escalates every crowd risk one band under heat stress', () => {
    const zones = [zone({ occupancy: 7_500, capacity: 10_000 })];
    const calm = buildSituationReport(snapshot({ zones }), AT);
    const hot = buildSituationReport(
      snapshot({ zones, weather: { tempC: 36, condition: 'Extreme heat', humidityPct: 68 } }),
      AT,
    );

    expect(calm.risks[0]?.level).toBe('elevated');
    expect(hot.risks[0]?.level).toBe('high');
    expect(hot.risks[0]?.detail).toContain('Heat and humidity raise this by one band');
  });

  it('flags an overloaded gate and says the queue is growing', () => {
    const report = buildSituationReport(
      snapshot({
        gates: [gate({ inflowPerMin: 150, throughputPerMin: 90, queueLen: 400 })],
      }),
      AT,
    );

    const risk = report.risks.find((r) => r.kind === 'gate');
    expect(risk?.level).toBe('critical');
    expect(risk?.detail).toContain('growing');
  });

  it('treats a very long queue as critical even when utilization looks fine', () => {
    // A gate that has caught up on rate can still be sitting on a dangerous mass
    // of people; utilization alone would miss it.
    const report = buildSituationReport(
      snapshot({ gates: [gate({ inflowPerMin: 50, throughputPerMin: 100, queueLen: 900 })] }),
      AT,
    );

    expect(report.risks.find((r) => r.kind === 'gate')?.level).toBe('critical');
  });

  it('does not flag a gate that is coping', () => {
    const report = buildSituationReport(
      snapshot({ gates: [gate({ inflowPerMin: 40, throughputPerMin: 100, queueLen: 10 })] }),
      AT,
    );
    expect(report.risks.filter((r) => r.kind === 'gate')).toEqual([]);
  });

  it('flags a delayed transit line as elevated', () => {
    const report = buildSituationReport(
      snapshot({
        transit: [{ line: 'Metro Blue Line', status: 'delayed', delayMin: 6, arrivalShare: 0.35 }],
      }),
      AT,
    );

    const risk = report.risks.find((r) => r.kind === 'transit');
    expect(risk?.level).toBe('elevated');
    expect(risk?.detail).toContain('35%');
  });

  it('flags a long transit delay as high', () => {
    const report = buildSituationReport(
      snapshot({
        transit: [{ line: 'Metro Blue Line', status: 'delayed', delayMin: 12, arrivalShare: 0.35 }],
      }),
      AT,
    );
    expect(report.risks.find((r) => r.kind === 'transit')?.level).toBe('high');
  });

  it('flags a line that is out of service as high', () => {
    const report = buildSituationReport(
      snapshot({
        transit: [{ line: 'Regional Rail', status: 'down', delayMin: 0, arrivalShare: 0.2 }],
      }),
      AT,
    );

    const risk = report.risks.find((r) => r.kind === 'transit');
    expect(risk?.level).toBe('high');
    expect(risk?.detail).toContain('out of service');
  });

  it('ignores a delay too small to matter', () => {
    const report = buildSituationReport(
      snapshot({
        transit: [{ line: 'Shuttle Network', status: 'delayed', delayMin: 2, arrivalShare: 0.2 }],
      }),
      AT,
    );
    expect(report.risks.filter((r) => r.kind === 'transit')).toEqual([]);
  });

  it('takes the overall level from the worst risk present', () => {
    const report = buildSituationReport(
      snapshot({
        zones: [zone({ id: 'z1', occupancy: 7_200, capacity: 10_000 })],
        gates: [gate({ inflowPerMin: 200, throughputPerMin: 90, queueLen: 900 })],
      }),
      AT,
    );
    expect(report.overall).toBe('critical');
  });

  it('sorts risks most-urgent first', () => {
    const report = buildSituationReport(
      snapshot({
        zones: [
          zone({ id: 'z1', name: 'North Lower', occupancy: 7_200, capacity: 10_000 }),
          zone({ id: 'z2', name: 'East Stand', occupancy: 9_700, capacity: 10_000 }),
        ],
      }),
      AT,
    );

    expect(report.risks[0]?.subjectId).toBe('z2');
    expect(report.risks[0]?.level).toBe('critical');
  });

  it('ranks a nearer ETA above a distant one at the same band', () => {
    const report = buildSituationReport(
      snapshot({
        zones: [
          zone({ id: 'slow', name: 'Slow', occupancy: 8_600, capacity: 10_000, netFlowPerMin: 5 }),
          zone({
            id: 'fast',
            name: 'Fast',
            occupancy: 8_600,
            capacity: 10_000,
            netFlowPerMin: 200,
          }),
        ],
      }),
      AT,
    );

    expect(report.risks[0]?.subjectId).toBe('fast');
  });

  it('orders equal-scoring risks by id, so the list never shuffles between ticks', () => {
    const zones = [
      zone({ id: 'zb', name: 'B', occupancy: 7_500, capacity: 10_000 }),
      zone({ id: 'za', name: 'A', occupancy: 7_500, capacity: 10_000 }),
    ];
    const first = buildSituationReport(snapshot({ zones }), AT);
    const second = buildSituationReport(snapshot({ zones }), AT);

    expect(first.risks.map((r) => r.id)).toEqual(second.risks.map((r) => r.id));
    expect(first.risks[0]?.subjectId).toBe('za');
  });

  it('handles an empty venue without throwing', () => {
    const report = buildSituationReport(snapshot({ zones: [], gates: [], transit: [] }), AT);
    expect(report.overall).toBe('normal');
    expect(report.risks).toEqual([]);
  });

  it('carries the snapshot through unmodified', () => {
    const snap = snapshot();
    expect(buildSituationReport(snap, AT).snapshot).toBe(snap);
  });
});
