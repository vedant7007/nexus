/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { resetConfigCache } from '@/lib/config';

const generateContent = vi.hoisted(() => vi.fn());

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent };
    }
  },
}));

const { extractJson, generateJson, generateText, resetAiClient } = await import('@/lib/ai/client');

/** Shapes a fake Gemini SDK response. */
function reply(text: string) {
  return { response: { text: () => text } };
}

beforeEach(() => {
  generateContent.mockReset();
  resetAiClient();
  resetConfigCache();
  process.env.GEMINI_API_KEY = 'test-key';
  resetConfigCache();
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  resetConfigCache();
  resetAiClient();
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
    generateContent.mockResolvedValue(reply('  All clear.  '));
    await expect(generateText('p')).resolves.toEqual({ ok: true, value: 'All clear.' });
  });

  it('reports not_configured when no API key is set — rule mode, not a crash', async () => {
    delete process.env.GEMINI_API_KEY;
    resetConfigCache();
    resetAiClient();

    const result = await generateText('p');
    expect(result).toEqual({
      ok: false,
      reason: 'not_configured',
      detail: 'GEMINI_API_KEY is not set',
    });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('treats empty output as invalid rather than passing it on', async () => {
    generateContent.mockResolvedValue(reply('   '));
    const result = await generateText('p');
    expect(result.ok).toBe(false);
  });

  it('reports an upstream error without throwing', async () => {
    generateContent.mockRejectedValue(new Error('HTTP 503 Service Unavailable'));

    const result = await generateText('p');
    expect(result).toMatchObject({ ok: false, reason: 'upstream_error' });
  });

  it('times out rather than hanging the control room', async () => {
    generateContent.mockImplementation(() => new Promise(() => {}));

    const result = await generateText('p', 20);
    expect(result).toMatchObject({ ok: false, reason: 'timeout' });
  });

  it('never leaks the API key into a failure detail', async () => {
    generateContent.mockRejectedValue(new Error('bad request'));

    const result = await generateText('p');
    expect(JSON.stringify(result)).not.toContain('test-key');
  });
});

describe('generateJson', () => {
  const schema = z.object({ reasoning: z.string().min(3) });

  it('returns validated output on success', async () => {
    generateContent.mockResolvedValue(reply('{"reasoning":"because"}'));
    await expect(generateJson('p', schema)).resolves.toEqual({
      ok: true,
      value: { reasoning: 'because' },
    });
  });

  it('unwraps a fenced response', async () => {
    generateContent.mockResolvedValue(reply('```json\n{"reasoning":"because"}\n```'));
    const result = await generateJson('p', schema);
    expect(result.ok).toBe(true);
  });

  it('rejects output of the wrong shape rather than passing it downstream', async () => {
    generateContent.mockResolvedValue(reply('{"nonsense":true}'));

    const result = await generateJson('p', schema);
    expect(result).toMatchObject({ ok: false, reason: 'invalid_output' });
  });

  it('rejects malformed JSON', async () => {
    generateContent.mockResolvedValue(reply('{"reasoning": '));
    const result = await generateJson('p', schema);
    expect(result).toMatchObject({ ok: false, reason: 'invalid_output' });
  });

  it('rejects prose where JSON was demanded', async () => {
    generateContent.mockResolvedValue(reply('I think you should reroute the fans.'));
    const result = await generateJson('p', schema);
    expect(result).toMatchObject({ ok: false, reason: 'invalid_output' });
  });

  it('propagates a timeout as a timeout, not a parse failure', async () => {
    generateContent.mockImplementation(() => new Promise(() => {}));
    const result = await generateJson('p', schema, 20);
    expect(result).toMatchObject({ ok: false, reason: 'timeout' });
  });

  it('never throws, whatever the model returns', async () => {
    for (const text of ['', 'null', '[]', '{}', 'undefined', '{{{']) {
      generateContent.mockResolvedValue(reply(text));
      await expect(generateJson('p', schema)).resolves.toBeDefined();
    }
  });
});
