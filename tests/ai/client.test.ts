/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { resetConfigCache } from '@/lib/config';

const getAccessToken = vi.hoisted(() => vi.fn());

vi.mock('google-auth-library', () => ({
  GoogleAuth: class {
    getAccessToken() {
      return getAccessToken();
    }
  },
}));

const { extractJson, generateJson, generateText, resetAiClient } = await import('@/lib/ai/client');

/** Wraps text in a Vertex generateContent response shape. */
function vertexReply(text: string): Response {
  const body = { candidates: [{ content: { parts: [{ text }] } }] };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  getAccessToken.mockReset();
  getAccessToken.mockResolvedValue('test-token');
  resetAiClient();
  resetConfigCache();
  // Vertex needs a project; ADC token is mocked above.
  process.env.FIREBASE_PROJECT_ID = 'nexus-test';
  vi.stubGlobal('fetch', vi.fn());
  resetConfigCache();
});

afterEach(() => {
  delete process.env.FIREBASE_PROJECT_ID;
  delete process.env.GEMINI_ACCESS_TOKEN;
  resetConfigCache();
  resetAiClient();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('extractJson', () => {
  it('reads a bare JSON object', () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });

  it('strips a ```json fence, which models add despite instructions', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('strips an unlabelled fence', () => {
    expect(extractJson('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('finds JSON wrapped in chatty prose', () => {
    expect(extractJson('Sure! Here you go:\n{"a":1}\nHope that helps.')).toBe('{"a":1}');
  });

  it('keeps nested objects intact', () => {
    expect(extractJson('{"a":{"b":[1,2]}}')).toBe('{"a":{"b":[1,2]}}');
  });

  it('returns null when there is no object at all', () => {
    expect(extractJson('I cannot help with that.')).toBeNull();
    expect(extractJson('')).toBeNull();
  });

  it('returns null for an unclosed object', () => {
    expect(extractJson('{"a": 1')).toBeNull();
  });
});

describe('generateText', () => {
  it('returns model text on success', async () => {
    vi.mocked(fetch).mockResolvedValue(vertexReply('  All clear.  '));
    await expect(generateText('p')).resolves.toEqual({ ok: true, value: 'All clear.' });
  });

  it('calls Vertex for the configured project, with a bearer token', async () => {
    vi.mocked(fetch).mockResolvedValue(vertexReply('ok'));
    await generateText('p');

    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(String(url)).toContain('aiplatform.googleapis.com');
    expect(String(url)).toContain('/projects/nexus-test/');
    expect(String(url)).toContain('gemini-2.5-flash');
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.authorization).toBe('Bearer test-token');
  });

  it('reports not_configured when no project is set — rule mode, not a crash', async () => {
    delete process.env.FIREBASE_PROJECT_ID;
    resetConfigCache();

    const result = await generateText('p');
    expect(result).toMatchObject({ ok: false, reason: 'not_configured' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports not_configured when no credentials are available', async () => {
    getAccessToken.mockResolvedValue(null);

    const result = await generateText('p');
    expect(result).toMatchObject({ ok: false, reason: 'not_configured' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses the GEMINI_ACCESS_TOKEN override without touching ADC', async () => {
    process.env.GEMINI_ACCESS_TOKEN = 'local-dev-token';
    vi.mocked(fetch).mockResolvedValue(vertexReply('ok'));

    await generateText('p');
    expect(getAccessToken).not.toHaveBeenCalled();
    const headers = (vi.mocked(fetch).mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>;
    expect(headers.authorization).toBe('Bearer local-dev-token');
  });

  it('treats empty output as invalid rather than passing it on', async () => {
    vi.mocked(fetch).mockResolvedValue(vertexReply('   '));
    const result = await generateText('p');
    expect(result.ok).toBe(false);
  });

  it('reports an upstream error (e.g. 429 quota) without throwing', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('quota', { status: 429 }));

    const result = await generateText('p');
    expect(result).toMatchObject({ ok: false, reason: 'upstream_error', detail: 'HTTP 429' });
  });

  it('times out rather than hanging the control room', async () => {
    // A fetch that only settles when its abort signal fires.
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );

    const result = await generateText('p', 20);
    expect(result).toMatchObject({ ok: false, reason: 'timeout' });
  });

  it('never leaks the access token into a failure detail', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));

    const result = await generateText('p');
    expect(JSON.stringify(result)).not.toContain('test-token');
  });
});

describe('generateJson', () => {
  const schema = z.object({ reasoning: z.string().min(3) });

  it('returns validated output on success', async () => {
    vi.mocked(fetch).mockResolvedValue(vertexReply('{"reasoning":"because"}'));
    await expect(generateJson('p', schema)).resolves.toEqual({
      ok: true,
      value: { reasoning: 'because' },
    });
  });

  it('unwraps a fenced response', async () => {
    vi.mocked(fetch).mockResolvedValue(vertexReply('```json\n{"reasoning":"because"}\n```'));
    const result = await generateJson('p', schema);
    expect(result.ok).toBe(true);
  });

  it('rejects output of the wrong shape rather than passing it downstream', async () => {
    vi.mocked(fetch).mockResolvedValue(vertexReply('{"nonsense":true}'));

    const result = await generateJson('p', schema);
    expect(result).toMatchObject({ ok: false, reason: 'invalid_output' });
  });

  it('rejects malformed JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(vertexReply('{"reasoning": '));
    const result = await generateJson('p', schema);
    expect(result).toMatchObject({ ok: false, reason: 'invalid_output' });
  });

  it('rejects prose where JSON was demanded', async () => {
    vi.mocked(fetch).mockResolvedValue(vertexReply('I think you should reroute the fans.'));
    const result = await generateJson('p', schema);
    expect(result).toMatchObject({ ok: false, reason: 'invalid_output' });
  });

  it('propagates a timeout as a timeout, not a parse failure', async () => {
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const result = await generateJson('p', schema, 20);
    expect(result).toMatchObject({ ok: false, reason: 'timeout' });
  });

  it('never throws, whatever the model returns', async () => {
    for (const text of ['', 'null', '[]', '{}', 'undefined', '{{{']) {
      vi.mocked(fetch).mockResolvedValue(vertexReply(text));
      await expect(generateJson('p', schema)).resolves.toBeDefined();
    }
  });
});
