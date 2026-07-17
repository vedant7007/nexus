/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildSituationReport } from '@/lib/engine/situation';
import { densityPct, utilizationPct } from '@/lib/engine/situation';
import type { Snapshot, ZoneState } from '@/lib/engine/types';

const generateText = vi.hoisted(() => vi.fn());
const generateJson = vi.hoisted(() => vi.fn());

vi.mock('@/lib/ai/client', () => ({ generateText, generateJson, extractJson: vi.fn() }));

const {
  briefingPrompt,
  factSheet,
  generateBriefing,
  generateReasoning,
  generateSustainabilityInsight,
  isPlausibleBriefing,
  reasoningPrompt,
  sustainabilityPrompt,
} = await import('@/lib/ai/briefing');

const AT = '2026-06-14T18:00:00.000Z';

function zone(over: Partial<ZoneState> = {}): ZoneState {
  const occupancy = over.occupancy ?? 9_400;
  const capacity = over.capacity ?? 10_000;
  return {
    id: 'z3',
    name: 'East Concourse',
    occupancy,
    capacity,
    densityPct: densityPct(occupancy, capacity),
    netFlowPerMin: 60,
    ...over,
  };
}

function snapshot(over: Partial<Snapshot> = {}): Snapshot {
  return {
    tMinusKickoffMin: 18,
    tick: 42,
    zones: [zone()],
    gates: [
      {
        id: 'gC',
        name: 'Gate C',
        inflowPerMin: 260,
        throughputPerMin: 220,
        queueLen: 640,
        utilizationPct: utilizationPct(260, 220),
        feedsZoneId: 'z3',
      },
    ],
    transit: [{ line: 'Metro Blue Line', status: 'delayed', delayMin: 12, arrivalShare: 0.35 }],
    weather: { tempC: 21, condition: 'Clear', humidityPct: 44 },
    resources: {
      energyKwh: 2_592,
      wasteDiversionPct: 71,
      waterLitres: 17_400,
      publicTransportSharePct: 58,
    },
    ...over,
  };
}

const REPORT = buildSituationReport(snapshot(), AT);

beforeEach(() => {
  generateText.mockReset();
  generateJson.mockReset();
});

describe('factSheet', () => {
  it('states the computed overall status', () => {
    expect(factSheet(REPORT)).toContain('OVERALL STATUS (computed): critical');
  });

  it('lists every detected risk with its computed level', () => {
    const sheet = factSheet(REPORT);
    expect(sheet).toContain('DETECTED RISKS');
    expect(sheet).toContain('[CRITICAL]');
  });

  it('includes zone, gate and transit facts the model may cite', () => {
    const sheet = factSheet(REPORT);
    expect(sheet).toContain('East Concourse');
    expect(sheet).toContain('Gate C');
    expect(sheet).toContain('Metro Blue Line');
  });

  it('renders "(none)" rather than an empty section for a calm venue', () => {
    const calm = buildSituationReport(
      snapshot({ zones: [zone({ occupancy: 4_000 })], gates: [], transit: [] }),
      AT,
    );
    expect(factSheet(calm)).toContain('(none)');
  });
});

describe('briefingPrompt', () => {
  it('forbids inventing numbers, in as many words', () => {
    const prompt = briefingPrompt(REPORT);
    expect(prompt).toContain('Use ONLY the facts and numbers given above');
    expect(prompt).toContain('Do not invent a safety threshold');
  });

  it('forbids contradicting the computed status', () => {
    expect(briefingPrompt(REPORT)).toContain('Do not contradict the computed overall status');
  });

  it('carries the fact sheet', () => {
    expect(briefingPrompt(REPORT)).toContain('East Concourse');
  });
});

describe('isPlausibleBriefing', () => {
  it('accepts a normal briefing', () => {
    expect(isPlausibleBriefing('A'.repeat(300))).toBe(true);
  });

  it('rejects output too short to be a briefing', () => {
    expect(isPlausibleBriefing('OK')).toBe(false);
    expect(isPlausibleBriefing('')).toBe(false);
  });

  it('rejects a runaway wall of text', () => {
    expect(isPlausibleBriefing('A'.repeat(5_000))).toBe(false);
  });
});

describe('generateBriefing', () => {
  it('returns the model briefing in ai mode on success', async () => {
    const text = 'Overall status is critical. Gate C is over capacity and the queue is growing.';
    generateText.mockResolvedValue({ ok: true, value: text });

    await expect(generateBriefing(REPORT)).resolves.toEqual({ text, mode: 'ai' });
  });

  it.each(['not_configured', 'timeout', 'upstream_error', 'invalid_output'])(
    'falls back to a factual templated briefing on %s',
    async (reason) => {
      generateText.mockResolvedValue({ ok: false, reason, detail: reason });

      const result = await generateBriefing(REPORT);

      expect(result.mode).toBe('rule');
      expect(result.text).toContain('Overall status is critical');
      // The fallback is the product, not an apology: it carries real numbers.
      expect(result.text).toContain('Gate C');
    },
  );

  it('falls back when the model returns implausible output', async () => {
    generateText.mockResolvedValue({ ok: true, value: 'ok' });

    const result = await generateBriefing(REPORT);
    expect(result.mode).toBe('rule');
  });

  it('never dead-ends — always returns renderable text', async () => {
    for (const value of ['', 'x', 'A'.repeat(9_999)]) {
      generateText.mockResolvedValue({ ok: true, value });
      const result = await generateBriefing(REPORT);
      expect(result.text.length).toBeGreaterThan(0);
    }
  });

  it('produces a calm briefing with no risks', async () => {
    generateText.mockResolvedValue({ ok: false, reason: 'timeout', detail: 'timeout' });
    const calm = buildSituationReport(
      snapshot({ zones: [zone({ occupancy: 3_000 })], gates: [], transit: [] }),
      AT,
    );

    const result = await generateBriefing(calm);
    expect(result.text).toContain('Overall status is normal');
    expect(result.text).toContain('No zone, gate or transit line is over threshold');
  });
});

describe('reasoningPrompt', () => {
  const risk = REPORT.risks[0];
  const chosen = {
    id: 'm1',
    action: 'Open the overflow lane at Gate C',
    impact: 'Throughput 220 → 264 people/min.',
    effectiveness: 20,
  };

  it('tells the model the decision is already made', () => {
    if (risk === undefined) throw new Error('fixture must produce a risk');
    const prompt = reasoningPrompt(risk, chosen, []);

    expect(prompt).toContain('already chosen by the engine');
    expect(prompt).toContain('Do NOT choose a different action');
    expect(prompt).toContain('Do NOT invent an impact figure');
  });

  it('lists the alternatives the engine considered', () => {
    if (risk === undefined) throw new Error('fixture must produce a risk');
    const prompt = reasoningPrompt(risk, chosen, [
      { id: 'm2', action: 'Reroute to Gate D', impact: '166% → 133%.', effectiveness: 33 },
    ]);

    expect(prompt).toContain('Reroute to Gate D');
  });
});

describe('generateReasoning', () => {
  const chosen = {
    id: 'm1',
    action: 'Open the overflow lane at Gate C',
    impact: 'Throughput 220 → 264 people/min.',
    effectiveness: 20,
  };

  it('returns model reasoning in ai mode', async () => {
    generateJson.mockResolvedValue({ ok: true, value: { reasoning: 'Because the queue grows.' } });
    const risk = REPORT.risks[0];
    if (risk === undefined) throw new Error('fixture must produce a risk');

    await expect(generateReasoning(risk, chosen, [])).resolves.toEqual({
      reasoning: 'Because the queue grows.',
      mode: 'ai',
    });
  });

  it('falls back to reasoning built from the engine action and impact', async () => {
    generateJson.mockResolvedValue({ ok: false, reason: 'timeout', detail: 'timeout' });
    const risk = REPORT.risks[0];
    if (risk === undefined) throw new Error('fixture must produce a risk');

    const result = await generateReasoning(risk, chosen, []);

    expect(result.mode).toBe('rule');
    // Still actionable: the operator is told what to do and why it was chosen.
    // The impact figures are deliberately absent — the card renders `impact`
    // beside this text, and repeating them would show the same numbers twice.
    expect(result.reasoning).toContain('open the overflow lane at Gate C');
    expect(result.reasoning).not.toContain('264 people/min');
  });
});

describe('generateSustainabilityInsight', () => {
  it('returns the model insight in ai mode', async () => {
    const text = 'Energy draw is 8% above baseline, driven by concourse cooling load.';
    generateText.mockResolvedValue({ ok: true, value: text });

    await expect(generateSustainabilityInsight(snapshot())).resolves.toEqual({ text, mode: 'ai' });
  });

  it('falls back to the computed drivers', async () => {
    generateText.mockResolvedValue({ ok: false, reason: 'timeout', detail: 'timeout' });

    const result = await generateSustainabilityInsight(snapshot());

    expect(result.mode).toBe('rule');
    expect(result.text).toContain('8% above the matchday baseline');
  });

  it('grounds the prompt in computed metrics only', () => {
    const prompt = sustainabilityPrompt(snapshot());
    expect(prompt).toContain('COMPUTED METRICS');
    expect(prompt).toContain('2592 kWh');
    expect(prompt).toContain('Use ONLY the facts and numbers given above');
  });
});
