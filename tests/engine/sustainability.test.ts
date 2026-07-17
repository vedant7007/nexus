import { describe, expect, it } from 'vitest';

import { densityPct } from '@/lib/engine/situation';
import { BASELINE, sustainabilitySummary } from '@/lib/engine/sustainability';
import type { Resources, Snapshot } from '@/lib/engine/types';

function snapshot(resources: Partial<Resources> = {}): Snapshot {
  return {
    tMinusKickoffMin: 10,
    tick: 50,
    zones: [
      {
        id: 'z1',
        name: 'North Lower',
        occupancy: 6_000,
        capacity: 10_000,
        densityPct: 60,
        netFlowPerMin: 0,
      },
      {
        id: 'z3',
        name: 'East Concourse',
        occupancy: 7_600,
        capacity: 8_000,
        densityPct: 95,
        netFlowPerMin: 0,
      },
      {
        id: 'z4',
        name: 'East Stand',
        occupancy: 10_000,
        capacity: 11_500,
        densityPct: densityPct(10_000, 11_500),
        netFlowPerMin: 0,
      },
    ],
    gates: [],
    transit: [],
    weather: { tempC: 22, condition: 'Clear', humidityPct: 45 },
    resources: { ...BASELINE, ...resources },
  };
}

describe('sustainabilitySummary', () => {
  it('reports a zero delta at exactly baseline', () => {
    const summary = sustainabilitySummary(snapshot());
    expect(summary.energyDeltaPct).toBe(0);
    expect(summary.drivers[0]).toContain('within');
  });

  it('computes the energy delta against baseline', () => {
    const summary = sustainabilitySummary(snapshot({ energyKwh: 2_592 }));
    expect(summary.energyDeltaPct).toBe(8);
  });

  it('attributes an overshoot to the densest zones, which drive HVAC load', () => {
    const summary = sustainabilitySummary(snapshot({ energyKwh: 2_592 }));

    expect(summary.drivers[0]).toContain('8% above');
    expect(summary.drivers[0]).toContain('East Concourse');
    expect(summary.drivers[0]).toContain('East Stand');
  });

  it('reports an underspend against baseline', () => {
    const summary = sustainabilitySummary(snapshot({ energyKwh: 2_100 }));
    expect(summary.energyDeltaPct).toBe(-12.5);
    expect(summary.drivers[0]).toContain('12.5% below');
  });

  it('flags waste diversion below target', () => {
    const summary = sustainabilitySummary(snapshot({ wasteDiversionPct: 61 }));
    expect(summary.drivers[1]).toContain('below the 75% target');
    expect(summary.onTarget).toBe(false);
  });

  it('confirms waste diversion at target', () => {
    const summary = sustainabilitySummary(snapshot({ wasteDiversionPct: 80 }));
    expect(summary.drivers[1]).toContain('meeting');
  });

  it('flags public transport share below target', () => {
    const summary = sustainabilitySummary(snapshot({ publicTransportSharePct: 48 }));
    expect(summary.drivers[2]).toContain('below the 60% target');
    expect(summary.onTarget).toBe(false);
  });

  it('confirms public transport share at or above target', () => {
    const summary = sustainabilitySummary(snapshot({ publicTransportSharePct: 62 }));
    expect(summary.drivers[2]).toContain('at or above');
  });

  it('is on target only when every metric is within band', () => {
    expect(sustainabilitySummary(snapshot()).onTarget).toBe(true);
    expect(sustainabilitySummary(snapshot({ energyKwh: 2_600 })).onTarget).toBe(false);
  });

  it('rounds reported figures to whole units', () => {
    const summary = sustainabilitySummary(
      snapshot({ energyKwh: 2_400.7, waterLitres: 17_999.4, wasteDiversionPct: 74.6 }),
    );

    expect(summary.energyKwh).toBe(2_401);
    expect(summary.waterLitres).toBe(17_999);
    expect(summary.wasteDiversionPct).toBe(75);
  });

  it('tolerates a zero baseline without dividing by zero', () => {
    const summary = sustainabilitySummary(snapshot({ energyKwh: 500 }), {
      ...BASELINE,
      energyKwh: 0,
    });
    expect(summary.energyDeltaPct).toBe(0);
  });

  it('is pure', () => {
    const snap = snapshot({ energyKwh: 2_600 });
    expect(sustainabilitySummary(snap)).toEqual(sustainabilitySummary(snap));
  });
});
