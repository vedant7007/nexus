/**
 * @vitest-environment node
 *
 * Integration tests over the real route handlers: auth, validation, rate
 * limiting, error shape, and the guarantee that the server owns every
 * safety-critical field regardless of what a client sends.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetAiCache } from '@/lib/ai/cache';
import { AI_RATE_LIMIT_PER_MIN, resetConfigCache } from '@/lib/config';
import { resetRateLimits } from '@/lib/server/rateLimit';
import { InMemoryIncidentRepository } from '@/lib/server/repository';
import { setRepositoryForTests } from '@/lib/server/repositoryProvider';

const generateJson = vi.hoisted(() => vi.fn());
const generateText = vi.hoisted(() => vi.fn());

vi.mock('@/lib/ai/client', () => ({
  generateJson,
  generateText,
  extractJson: vi.fn(),
  resetAiClient: vi.fn(),
}));

const { GET: simGet } = await import('@/app/api/sim/route');
const { GET: situationGet } = await import('@/app/api/situation/route');
const { GET: recsGet } = await import('@/app/api/recommendations/route');
const { POST: briefingPost } = await import('@/app/api/ai/briefing/route');
const { POST: triagePost } = await import('@/app/api/ai/triage/route');
const { GET: incidentsGet, POST: incidentsPost } = await import('@/app/api/incidents/route');
const { PATCH: incidentPatch } = await import('@/app/api/incidents/[id]/route');

const repo = new InMemoryIncidentRepository();

/** Builds a request carrying a bearer token. */
function req(url: string, init: RequestInit = {}): Request {
  return new Request(url, {
    ...init,
    headers: {
      authorization: 'Bearer test-token',
      'content-type': 'application/json',
      ...init.headers,
    },
  });
}

/** Builds a request with no Authorization header. */
function anonReq(url: string, init: RequestInit = {}): Request {
  return new Request(url, { ...init, headers: { 'content-type': 'application/json' } });
}

/** A well-formed model triage proposal. */
const AI_PROPOSAL = {
  ok: true as const,
  value: {
    detectedLanguage: 'Spanish',
    englishText: 'A person has fainted in section 114.',
    proposedType: 'medical',
    protocolSteps: ['Send a medic.'],
  },
};

beforeEach(() => {
  repo.clear();
  setRepositoryForTests(repo);
  resetRateLimits();
  resetConfigCache();
  resetAiCache();
  generateJson.mockReset();
  generateText.mockReset();
  generateJson.mockResolvedValue(AI_PROPOSAL);
  generateText.mockResolvedValue({ ok: true, value: 'A'.repeat(120) });
});

afterEach(() => {
  setRepositoryForTests(null);
  vi.restoreAllMocks();
});

describe('authentication', () => {
  const cases: [string, () => Promise<Response>][] = [
    ['GET /api/sim', () => simGet(anonReq('http://t/api/sim'))],
    ['GET /api/situation', () => situationGet(anonReq('http://t/api/situation'))],
    ['GET /api/recommendations', () => recsGet(anonReq('http://t/api/recommendations'))],
    ['GET /api/incidents', () => incidentsGet(anonReq('http://t/api/incidents'))],
    [
      'POST /api/incidents',
      () => incidentsPost(anonReq('http://t/api/incidents', { method: 'POST', body: '{}' })),
    ],
    [
      'POST /api/ai/briefing',
      () => briefingPost(anonReq('http://t/api/ai/briefing', { method: 'POST', body: '{}' })),
    ],
    [
      'POST /api/ai/triage',
      () => triagePost(anonReq('http://t/api/ai/triage', { method: 'POST', body: '{}' })),
    ],
  ];

  it.each(cases)('%s rejects an anonymous request with 401', async (_name, call) => {
    const response = await call();
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error.code).toBe('unauthenticated');
  });

  it('rejects a malformed Authorization header', async () => {
    const response = await simGet(
      new Request('http://t/api/sim', { headers: { authorization: 'Basic abc' } }),
    );
    expect(response.status).toBe(401);
  });
});

describe('GET /api/sim', () => {
  it('returns a snapshot', async () => {
    const response = await simGet(req('http://t/api/sim?scenario=normal&tick=40'));
    expect(response.status).toBe(200);

    const snapshot = await response.json();
    expect(snapshot.zones).toHaveLength(8);
    expect(snapshot.gates).toHaveLength(6);
    expect(snapshot.tick).toBe(40);
  });

  it('falls back to the default scenario for an unknown one', async () => {
    const response = await simGet(req('http://t/api/sim?scenario=../../etc/passwd&tick=10'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ tick: 10 });
  });

  it('is deterministic for the same query', async () => {
    const one = await (await simGet(req('http://t/api/sim?scenario=gate_surge&tick=50'))).json();
    const two = await (await simGet(req('http://t/api/sim?scenario=gate_surge&tick=50'))).json();
    expect(one).toEqual(two);
  });
});

describe('GET /api/situation', () => {
  it('returns the deterministic report with detected risks', async () => {
    const response = await situationGet(req('http://t/api/situation?scenario=gate_surge&tick=40'));
    expect(response.status).toBe(200);

    const report = await response.json();
    expect(report.overall).toBe('critical');
    expect(report.risks.length).toBeGreaterThan(0);
  });

  it('never calls the AI — the safety report must not depend on it', async () => {
    await situationGet(req('http://t/api/situation?scenario=gate_surge&tick=40'));
    expect(generateText).not.toHaveBeenCalled();
    expect(generateJson).not.toHaveBeenCalled();
  });
});

describe('POST /api/ai/briefing', () => {
  const body = JSON.stringify({ scenario: 'gate_surge', tick: 40 });

  it('returns an AI briefing when the model answers', async () => {
    const response = await briefingPost(req('http://t/api/ai/briefing', { method: 'POST', body }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ mode: 'ai' });
  });

  it('returns a rule-mode briefing when the model fails — never a broken panel', async () => {
    generateText.mockResolvedValue({ ok: false, reason: 'upstream_error', detail: 'down' });

    const response = await briefingPost(req('http://t/api/ai/briefing', { method: 'POST', body }));
    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.mode).toBe('rule');
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('serves the sustainability insight kind', async () => {
    const response = await briefingPost(
      req('http://t/api/ai/briefing', {
        method: 'POST',
        body: JSON.stringify({ scenario: 'heat_wave', tick: 60, kind: 'sustainability' }),
      }),
    );
    expect(response.status).toBe(200);
  });

  it('rejects an unknown scenario with field-level detail', async () => {
    const response = await briefingPost(
      req('http://t/api/ai/briefing', {
        method: 'POST',
        body: JSON.stringify({ scenario: 'nope', tick: 1 }),
      }),
    );

    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error.error.code).toBe('invalid_request');
    expect(error.error.fields).toHaveProperty('scenario');
  });

  it('rejects a non-JSON body', async () => {
    const response = await briefingPost(
      req('http://t/api/ai/briefing', { method: 'POST', body: 'not json' }),
    );
    expect(response.status).toBe(400);
  });

  it('rate-limits after the configured number of calls', async () => {
    // Derived from the constant, not hardcoded: the test tracks the limit
    // wherever it is tuned rather than pinning a number that silently rots.
    const results: number[] = [];
    for (let i = 0; i < AI_RATE_LIMIT_PER_MIN + 2; i += 1) {
      const response = await briefingPost(
        req('http://t/api/ai/briefing', { method: 'POST', body }),
      );
      results.push(response.status);
    }

    expect(results.filter((s) => s === 200)).toHaveLength(AI_RATE_LIMIT_PER_MIN);
    expect(results.filter((s) => s === 429).length).toBeGreaterThan(0);
  });

  it('returns a rate_limited code with a retry hint', async () => {
    for (let i = 0; i < AI_RATE_LIMIT_PER_MIN; i += 1) {
      await briefingPost(req('http://t/api/ai/briefing', { method: 'POST', body }));
    }

    const response = await briefingPost(req('http://t/api/ai/briefing', { method: 'POST', body }));
    expect(response.status).toBe(429);

    const error = await response.json();
    expect(error.error.code).toBe('rate_limited');
    expect(error.error.message).toContain('Retry in');
  });
});

describe('GET /api/recommendations', () => {
  it('returns engine actions with AI reasoning', async () => {
    generateJson.mockResolvedValue({ ok: true, value: { reasoning: 'A'.repeat(40) } });

    const response = await recsGet(req('http://t/api/recommendations?scenario=gate_surge&tick=40'));
    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.mode).toBe('ai');
    expect(result.items[0].impact).toMatch(/\d/);
  });

  it('keeps engine-computed impacts when the AI fails', async () => {
    generateJson.mockResolvedValue({ ok: false, reason: 'timeout', detail: 'timeout' });

    const response = await recsGet(req('http://t/api/recommendations?scenario=gate_surge&tick=40'));
    const result = await response.json();

    expect(result.mode).toBe('rule');
    // The numbers survive: a failed AI call costs prose, not correctness.
    expect(result.items[0].impact).toMatch(/\d/);
    expect(result.items[0].action.length).toBeGreaterThan(0);
    expect(result.items[0].reasoning.length).toBeGreaterThan(0);
  });
});

describe('POST /api/incidents', () => {
  const spanish = JSON.stringify({
    rawText: 'hay una persona desmayada en la sección 114',
    zoneId: 'z3',
    scenario: 'normal',
    tick: 40,
  });

  it('creates a triaged incident', async () => {
    const response = await incidentsPost(
      req('http://t/api/incidents', { method: 'POST', body: spanish }),
    );
    expect(response.status).toBe(200);

    const incident = await response.json();
    expect(incident.id).toBeDefined();
    expect(incident.status).toBe('open');
    expect(incident.language).toBe('Spanish');
  });

  /** The server-owns-safety guarantee, at the HTTP boundary. */
  it('ignores a severity the client tries to dictate', async () => {
    const response = await incidentsPost(
      req('http://t/api/incidents', {
        method: 'POST',
        body: JSON.stringify({
          rawText: 'person is unconscious near gate C',
          zoneId: 'z3',
          severity: 'SEV3',
          team: 'Facilities',
        }),
      }),
    );

    const incident = await response.json();
    expect(incident.severity).toBe('SEV1');
    expect(incident.team).toContain('Medical');
  });

  it('records SEV1 for a Spanish emergency even when the model says facilities', async () => {
    generateJson.mockResolvedValue({
      ok: true,
      value: {
        detectedLanguage: 'Spanish',
        englishText: 'Someone is resting.',
        proposedType: 'facilities',
        protocolSteps: ['Check on them.'],
      },
    });

    const response = await incidentsPost(
      req('http://t/api/incidents', { method: 'POST', body: spanish }),
    );
    const incident = await response.json();

    expect(incident.severity).toBe('SEV1');
    expect(incident.matchedRule).toContain('life-safety keyword');
  });

  it('records SEV1 with the AI down entirely', async () => {
    generateJson.mockResolvedValue({ ok: false, reason: 'upstream_error', detail: 'down' });

    const response = await incidentsPost(
      req('http://t/api/incidents', { method: 'POST', body: spanish }),
    );
    const incident = await response.json();

    expect(incident.mode).toBe('rule');
    expect(incident.severity).toBe('SEV1');
  });

  it('rejects an unknown zone', async () => {
    const response = await incidentsPost(
      req('http://t/api/incidents', {
        method: 'POST',
        body: JSON.stringify({ rawText: 'something happened', zoneId: 'z99' }),
      }),
    );

    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error.error.fields.zoneId).toContain('Unknown zone.');
  });

  it.each([
    ['empty text', { rawText: '', zoneId: 'z1' }],
    ['text too short', { rawText: 'x', zoneId: 'z1' }],
    ['missing zone', { rawText: 'a real report' }],
    ['oversized text', { rawText: 'x'.repeat(5_000), zoneId: 'z1' }],
  ])('rejects %s with 400', async (_name, body) => {
    const response = await incidentsPost(
      req('http://t/api/incidents', { method: 'POST', body: JSON.stringify(body) }),
    );
    expect(response.status).toBe(400);
  });

  it('stamps the authenticated uid, not anything from the body', async () => {
    const response = await incidentsPost(
      req('http://t/api/incidents', {
        method: 'POST',
        body: JSON.stringify({ rawText: 'a bin is full', zoneId: 'z1', createdBy: 'attacker' }),
      }),
    );

    const incident = await response.json();
    expect(incident.createdBy).not.toBe('attacker');
  });
});

describe('GET /api/incidents', () => {
  it('returns an empty list when nothing is logged', async () => {
    const response = await incidentsGet(req('http://t/api/incidents'));
    await expect(response.json()).resolves.toEqual({ incidents: [] });
  });

  it('lists most severe first', async () => {
    generateJson.mockResolvedValue({ ok: false, reason: 'timeout', detail: 'timeout' });

    await incidentsPost(
      req('http://t/api/incidents', {
        method: 'POST',
        body: JSON.stringify({ rawText: 'a bin is overflowing', zoneId: 'z1' }),
      }),
    );
    await incidentsPost(
      req('http://t/api/incidents', {
        method: 'POST',
        body: JSON.stringify({ rawText: 'person unconscious at gate C', zoneId: 'z3' }),
      }),
    );

    const { incidents } = await (await incidentsGet(req('http://t/api/incidents'))).json();
    expect(incidents[0].severity).toBe('SEV1');
  });
});

describe('PATCH /api/incidents/[id]', () => {
  /** Creates one incident and returns its id. */
  async function seed(): Promise<string> {
    const response = await incidentsPost(
      req('http://t/api/incidents', {
        method: 'POST',
        body: JSON.stringify({ rawText: 'a bin is overflowing', zoneId: 'z1' }),
      }),
    );
    return (await response.json()).id;
  }

  it('updates status', async () => {
    const id = await seed();

    const response = await incidentPatch(
      req(`http://t/api/incidents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'acknowledged' }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id, status: 'acknowledged' });
  });

  it('returns 404 for an unknown incident', async () => {
    const response = await incidentPatch(
      req('http://t/api/incidents/nope', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'resolved' }),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'not_found' } });
  });

  it('rejects an invalid status', async () => {
    const id = await seed();
    const response = await incidentPatch(
      req(`http://t/api/incidents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'deleted' }),
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe('POST /api/ai/triage', () => {
  it('previews triage without persisting', async () => {
    const response = await triagePost(
      req('http://t/api/ai/triage', {
        method: 'POST',
        body: JSON.stringify({ rawText: 'hay una persona desmayada', zoneId: 'z3' }),
      }),
    );

    expect(response.status).toBe(200);
    const preview = await response.json();
    expect(preview.severity).toBe('SEV1');
    expect(preview.matchedRule).toContain('life-safety');

    const { incidents } = await (await incidentsGet(req('http://t/api/incidents'))).json();
    expect(incidents).toEqual([]);
  });
});

describe('error responses', () => {
  it('never leaks internal detail when a dependency explodes', async () => {
    const exploding = {
      create: () => Promise.reject(new Error('FIRESTORE_INTERNAL: creds at /secrets/key.json')),
      list: () => Promise.reject(new Error('boom')),
      findById: () => Promise.resolve(null),
      updateStatus: () => Promise.resolve(null),
    };
    setRepositoryForTests(exploding);

    const response = await incidentsGet(req('http://t/api/incidents'));

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain('FIRESTORE_INTERNAL');
    expect(text).not.toContain('key.json');
    expect(JSON.parse(text)).toEqual({
      error: { code: 'internal', message: 'An unexpected error occurred.' },
    });
  });
});
