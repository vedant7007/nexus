/**
 * @vitest-environment node
 *
 * The safety-critical AI tests. Everything here exists to prove one claim:
 * the language model cannot make NEXUS less safe, however it misbehaves.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetAiCache } from '@/lib/ai/cache';
import { resetConfigCache } from '@/lib/config';

const generateJson = vi.hoisted(() => vi.fn());

vi.mock('@/lib/ai/client', () => ({
  generateJson,
  generateText: vi.fn(),
  extractJson: vi.fn(),
  resetAiClient: vi.fn(),
}));

const { MAX_REPORT_CHARS, decide, triageIncident, triagePrompt, triageProposalSchema } =
  await import('@/lib/ai/triage');

const CONTEXT = {
  nearestFirstAidZoneId: 'fa-east',
  firstAidName: 'East Medical Centre',
  zoneIsCritical: false,
};

/** A well-formed model proposal, overridable per test. */
function proposal(over: Record<string, unknown> = {}) {
  return {
    ok: true as const,
    value: {
      detectedLanguage: 'Spanish',
      englishText: 'There is a person who has fainted in section 114.',
      proposedType: 'medical',
      protocolSteps: ['Send a medic.', 'Clear a route.'],
      ...over,
    },
  };
}

beforeEach(() => {
  generateJson.mockReset();
  resetConfigCache();
  resetAiCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('triageProposalSchema — the interlock is structural', () => {
  it('has no severity field, so the model cannot express one', () => {
    const shape = triageProposalSchema.shape;
    expect(Object.keys(shape)).toEqual([
      'detectedLanguage',
      'englishText',
      'proposedType',
      'protocolSteps',
    ]);
  });

  it('strips a severity the model tries to volunteer anyway', () => {
    const parsed = triageProposalSchema.parse({
      detectedLanguage: 'English',
      englishText: 'A person collapsed.',
      proposedType: 'medical',
      protocolSteps: ['Respond.'],
      severity: 'SEV3',
      team: 'Facilities',
    });

    expect(parsed).not.toHaveProperty('severity');
    expect(parsed).not.toHaveProperty('team');
  });

  it('rejects an invented incident type', () => {
    const result = triageProposalSchema.safeParse({
      detectedLanguage: 'English',
      englishText: 'x',
      proposedType: 'apocalypse',
      protocolSteps: ['run'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty protocol', () => {
    const result = triageProposalSchema.safeParse({
      detectedLanguage: 'English',
      englishText: 'x',
      proposedType: 'medical',
      protocolSteps: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('triagePrompt', () => {
  it('embeds the report verbatim', () => {
    expect(triagePrompt('hay una persona desmayada')).toContain('hay una persona desmayada');
  });

  it('forbids the model from assigning severity or routing', () => {
    const prompt = triagePrompt('test');
    expect(prompt).toContain('Do NOT assign a severity');
    expect(prompt).toContain('Do NOT decide which team responds');
  });

  it('demands a faithful translation of life-safety wording', () => {
    expect(triagePrompt('test')).toContain('unconscious');
  });

  it('bounds report length', () => {
    expect(MAX_REPORT_CHARS).toBeGreaterThan(0);
    expect(MAX_REPORT_CHARS).toBeLessThanOrEqual(2_000);
  });
});

describe('decide — the engine owns the outcome', () => {
  it('returns SEV1 for a life-safety report', () => {
    expect(decide('medical', ['person is unconscious'], CONTEXT).severity).toBe('SEV1');
  });

  it('escalates any incident in a critical zone', () => {
    const decision = decide('facilities', ['a tap is leaking'], {
      ...CONTEXT,
      zoneIsCritical: true,
    });
    expect(decision.severity).toBe('SEV1');
  });

  it('routes to the first-aid point supplied by the caller, not the model', () => {
    expect(decide('medical', ['x'], CONTEXT).nearestFirstAidZoneId).toBe('fa-east');
  });
});

describe('triageIncident — AI path', () => {
  it('uses the model translation and language when the call succeeds', async () => {
    generateJson.mockResolvedValue(proposal());

    const result = await triageIncident('hay una persona desmayada en la sección 114', CONTEXT);

    expect(result.mode).toBe('ai');
    expect(result.detectedLanguage).toBe('Spanish');
    expect(result.englishText).toContain('fainted');
  });

  /** The headline guarantee, stated as plainly as a test can state it. */
  it('returns SEV1 even when the model proposes "facilities" for an unconscious person', async () => {
    generateJson.mockResolvedValue(
      proposal({
        proposedType: 'facilities',
        englishText: 'A person is unconscious near the concourse.',
        protocolSteps: ['Mop the floor.'],
      }),
    );

    const result = await triageIncident('una persona desmayada', CONTEXT);

    expect(result.decision.severity).toBe('SEV1');
    expect(result.decision.matchedRule).toContain('overrides proposed type');
    // And the model's inadequate protocol is discarded for the rule-based one.
    expect(result.protocol).not.toContain('Mop the floor.');
    expect(result.protocol.join(' ')).toContain('East Medical Centre');
  });

  it('catches a life-safety term in the raw text that the model translated away', async () => {
    // The nightmare case: a mistranslation that launders an emergency into a
    // routine report. The raw text is scanned regardless of what the model said.
    generateJson.mockResolvedValue(
      proposal({
        proposedType: 'facilities',
        englishText: 'Someone is resting in section 114.',
      }),
    );

    const result = await triageIncident('hay una persona desmayada en la sección 114', CONTEXT);
    expect(result.decision.severity).toBe('SEV1');
  });

  it('keeps the model protocol for a genuinely minor incident', async () => {
    generateJson.mockResolvedValue(
      proposal({
        detectedLanguage: 'English',
        englishText: 'A bin is overflowing in the west concourse.',
        proposedType: 'facilities',
        protocolSteps: ['Send cleaning crew.', 'Replace the liner.'],
      }),
    );

    const result = await triageIncident('bin overflowing', CONTEXT);

    expect(result.decision.severity).toBe('SEV3');
    expect(result.protocol).toEqual(['Send cleaning crew.', 'Replace the liner.']);
  });

  it('still escalates via zone risk on the AI path', async () => {
    generateJson.mockResolvedValue(
      proposal({ proposedType: 'facilities', englishText: 'A sign fell over.' }),
    );

    const result = await triageIncident('a sign fell over', { ...CONTEXT, zoneIsCritical: true });
    expect(result.decision.severity).toBe('SEV1');
  });
});

describe('triageIncident — fallback path', () => {
  it.each([
    ['not_configured', 'GEMINI_API_KEY is not set'],
    ['timeout', 'timeout'],
    ['upstream_error', 'HTTP 503'],
    ['invalid_output', 'schema mismatch: proposedType'],
  ])('degrades to rule mode on %s', async (reason, detail) => {
    generateJson.mockResolvedValue({ ok: false, reason, detail });

    const result = await triageIncident('person collapsed at gate B', CONTEXT);

    expect(result.mode).toBe('rule');
    expect(result.protocol.length).toBeGreaterThan(0);
    expect(result.englishText).toBe('person collapsed at gate B');
  });

  /**
   * The single most important test in the codebase: with the AI entirely gone,
   * a Spanish life-safety report still triages correctly.
   */
  it('returns SEV1 for an untranslated Spanish emergency with the AI down', async () => {
    generateJson.mockResolvedValue({ ok: false, reason: 'upstream_error', detail: 'down' });

    const result = await triageIncident('hay una persona desmayada en la sección 114', CONTEXT);

    expect(result.mode).toBe('rule');
    expect(result.decision.severity).toBe('SEV1');
    expect(result.decision.team).toContain('Medical');
  });

  it('returns SEV1 for an untranslated Bengali emergency with the AI down', async () => {
    generateJson.mockResolvedValue({ ok: false, reason: 'timeout', detail: 'timeout' });

    const result = await triageIncident('গেট বি-তে একজন অজ্ঞান', CONTEXT);
    expect(result.decision.severity).toBe('SEV1');
  });

  it('always produces an actionable protocol with the AI down', async () => {
    generateJson.mockResolvedValue({ ok: false, reason: 'timeout', detail: 'timeout' });

    const result = await triageIncident('unconscious person', CONTEXT);

    expect(result.protocol.length).toBeGreaterThanOrEqual(3);
    expect(result.protocol.join(' ')).toContain('East Medical Centre');
  });

  it('never throws, whatever the client returns', async () => {
    generateJson.mockResolvedValue({ ok: false, reason: 'upstream_error', detail: 'boom' });
    await expect(triageIncident('x', CONTEXT)).resolves.toBeDefined();
  });
});

/**
 * Equality of the safety-critical path across both modes. If these diverge,
 * the fallback has become a second-class citizen and the guarantee is hollow.
 */
describe('triageIncident — AI and rule modes agree on safety', () => {
  const cases = [
    'hay una persona desmayada',
    'person unconscious in section 114',
    'গেট বি-তে একজন অজ্ঞান',
    'जोन 3 में आग',
  ];

  it.each(cases)('assigns the same severity with and without AI: "%s"', async (text) => {
    generateJson.mockResolvedValue(
      proposal({ proposedType: 'facilities', englishText: 'something happened' }),
    );
    const withAi = await triageIncident(text, CONTEXT);

    // Clear the AI-understanding cache: this test deliberately drives the SAME
    // text through two backend states, which the cache would otherwise (rightly)
    // short-circuit. A real repeated report reuses the translation; here we want
    // the fresh rule-mode path.
    resetAiCache();
    generateJson.mockResolvedValue({ ok: false, reason: 'timeout', detail: 'timeout' });
    const withoutAi = await triageIncident(text, CONTEXT);

    expect(withAi.mode).toBe('ai');
    expect(withoutAi.mode).toBe('rule');
    expect(withAi.decision.severity).toBe(withoutAi.decision.severity);
    expect(withAi.decision.severity).toBe('SEV1');
  });
});
