/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { apiFetch } from '@/lib/ui/apiClient';

const schema = z.object({ value: z.number() });

/** Always supplies a token. */
const token = async (): Promise<string> => 'test-token';

/** Builds a fake Response. */
function reply(body: unknown, status = 200): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('apiFetch', () => {
  it('returns validated data on success', async () => {
    vi.mocked(fetch).mockResolvedValue(reply({ value: 42 }));

    await expect(apiFetch('/api/x', schema, token)).resolves.toEqual({
      ok: true,
      value: { value: 42 },
    });
  });

  it('sends the bearer token', async () => {
    vi.mocked(fetch).mockResolvedValue(reply({ value: 1 }));
    await apiFetch('/api/x', schema, token);

    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(init?.headers).toMatchObject({ authorization: 'Bearer test-token' });
  });

  it('refuses to call the API when signed out', async () => {
    const result = await apiFetch('/api/x', schema, async () => null);

    expect(result).toEqual({
      ok: false,
      error: { code: 'unauthenticated', message: 'Please sign in to continue.' },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('serialises a body and sets the content type', async () => {
    vi.mocked(fetch).mockResolvedValue(reply({ value: 1 }));
    await apiFetch('/api/x', schema, token, { method: 'POST', body: { a: 1 } });

    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"a":1}');
    expect(init?.headers).toMatchObject({ 'content-type': 'application/json' });
  });

  it('omits a content type when there is no body', async () => {
    vi.mocked(fetch).mockResolvedValue(reply({ value: 1 }));
    await apiFetch('/api/x', schema, token);

    const headers = vi.mocked(fetch).mock.calls[0]?.[1]?.headers;
    expect(headers).not.toHaveProperty('content-type');
  });

  it('surfaces the server error envelope', async () => {
    vi.mocked(fetch).mockResolvedValue(
      reply({ error: { code: 'rate_limited', message: 'Slow down.' } }, 429),
    );

    await expect(apiFetch('/api/x', schema, token)).resolves.toEqual({
      ok: false,
      error: { code: 'rate_limited', message: 'Slow down.' },
    });
  });

  it('surfaces field errors for a validation failure', async () => {
    vi.mocked(fetch).mockResolvedValue(
      reply(
        {
          error: {
            code: 'invalid_request',
            message: 'Bad.',
            fields: { zoneId: ['Unknown zone.'] },
          },
        },
        400,
      ),
    );

    const result = await apiFetch('/api/x', schema, token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.fields?.zoneId).toEqual(['Unknown zone.']);
  });

  it('falls back to a generic message when an error body is not our envelope', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('<html>502</html>', { status: 502 }));

    const result = await apiFetch('/api/x', schema, token);
    expect(result).toMatchObject({ ok: false, error: { code: 'http_error' } });
  });

  it('reports a network failure without throwing', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(apiFetch('/api/x', schema, token)).resolves.toMatchObject({
      ok: false,
      error: { code: 'network' },
    });
  });

  it('rethrows an abort so the caller can ignore it', async () => {
    vi.mocked(fetch).mockRejectedValue(new DOMException('aborted', 'AbortError'));
    await expect(apiFetch('/api/x', schema, token)).rejects.toThrow(DOMException);
  });

  it('rejects a response of the wrong shape rather than passing it on', async () => {
    vi.mocked(fetch).mockResolvedValue(reply({ nonsense: true }));

    await expect(apiFetch('/api/x', schema, token)).resolves.toMatchObject({
      ok: false,
      error: { code: 'malformed_response' },
    });
  });

  it('rejects a non-JSON success body', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('not json', { status: 200 }));

    await expect(apiFetch('/api/x', schema, token)).resolves.toMatchObject({
      ok: false,
      error: { code: 'malformed_response' },
    });
  });

  it('never throws for any plausible response', async () => {
    for (const body of ['', 'null', '[]', '{}', '{{{']) {
      vi.mocked(fetch).mockResolvedValue(new Response(body, { status: 200 }));
      await expect(apiFetch('/api/x', schema, token)).resolves.toBeDefined();
    }
  });
});
