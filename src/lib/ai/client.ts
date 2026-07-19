// The only module that talks to Gemini, and the only one that decides an AI call
// failed. Gemini is reached through Vertex AI (not the AI-Studio API): Vertex bills
// Cloud Billing directly, where the AI-Studio API in some regions is gated by a
// separate prepaid balance, and it authenticates with the runtime's own ADC
// credentials — so there is no API key to store, rotate, or leak. Every call routes
// through generateJson/generateText, which guarantee a hard timeout, never throw
// (failure is a typed value), validate model output with Zod, and stay server-only.
import { GoogleAuth } from 'google-auth-library';
import { z } from 'zod';

import { AI_TIMEOUT_MS, GEMINI_MODEL, serverConfig } from '../config';
import { describeError, logger } from '../server/logger';

/**
 * Generation config for every call.
 *
 * `thinkingBudget: 0` disables gemini-2.5-flash's extended reasoning. Our tasks
 * are rephrasing computed facts into prose and translating/classifying an
 * incident — not multi-step reasoning — so thinking adds several seconds of
 * latency for no quality gain. Disabling it cut a real briefing from ~7.9s to
 * ~1.9s in testing, the difference between the AI path succeeding inside the
 * timeout and silently falling back to rule mode on every call.
 */
const GENERATION_CONFIG = {
  thinkingConfig: { thinkingBudget: 0 },
} as const;

const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

/** Why an AI call did not produce usable output. */
export type AiFailureReason = 'not_configured' | 'timeout' | 'upstream_error' | 'invalid_output';

/** The result of an AI call. Failure is a value, never an exception. */
export type AiResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: AiFailureReason; detail: string };

/** The slice of a Vertex response we read, validated rather than trusted. */
const vertexResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({ parts: z.array(z.object({ text: z.string().optional() })).optional() })
          .optional(),
      }),
    )
    .optional(),
});

let cachedAuth: GoogleAuth | null = null;

/**
 * Acquires an access token for Vertex AI.
 *
 * On Cloud Run this comes from the service account via ADC — no configuration,
 * no key. `GEMINI_ACCESS_TOKEN` is an explicit override for local development,
 * where ADC may not be set up: a `gcloud auth print-access-token` value can be
 * exported to exercise the real path without `gcloud auth application-default
 * login`. Absent both, the caller degrades to rule mode.
 */
async function getAccessToken(): Promise<string | null> {
  const override = process.env.GEMINI_ACCESS_TOKEN;
  if (override !== undefined && override.length > 0) return override;

  try {
    cachedAuth ??= new GoogleAuth({ scopes: CLOUD_PLATFORM_SCOPE });
    const token = await cachedAuth.getAccessToken();
    return token ?? null;
  } catch (error) {
    logger.warn('vertex ADC token acquisition failed', { detail: describeError(error) });
    return null;
  }
}

function vertexUrl(project: string, location: string): string {
  const host =
    location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${GEMINI_MODEL}:generateContent`;
}

function extractVertexText(data: unknown): string {
  const parsed = vertexResponseSchema.safeParse(data);
  if (!parsed.success) return '';
  const parts = parsed.data.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => part.text ?? '')
    .join('')
    .trim();
}

/**
 * Extracts a JSON object from a model response.
 *
 * Models wrap JSON in ```json fences or prose despite instructions not to, so
 * strip fences and fall back to the outermost brace-delimited span. This is
 * tolerance for known formatting habits, not for invented content — the result
 * still has to satisfy the caller's schema.
 */
export function extractJson(raw: string): string | null {
  // No \s* before the lazy capture: two variable-width matchers that both eat
  // whitespace force backtracking. The body is trimmed below regardless.
  const fenced = /```(?:json)?([\s\S]*?)```/i.exec(raw);
  const body = (fenced?.[1] ?? raw).trim();

  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  return body.slice(start, end + 1);
}

/** Calls Gemini and returns raw text. Never throws. */
export async function generateText(
  prompt: string,
  timeoutMs: number = AI_TIMEOUT_MS,
): Promise<AiResult<string>> {
  const { FIREBASE_PROJECT_ID: project, GEMINI_LOCATION: location } = serverConfig();
  if (project === undefined) {
    return { ok: false, reason: 'not_configured', detail: 'no GCP project configured' };
  }

  const token = await getAccessToken();
  if (token === null) {
    return { ok: false, reason: 'not_configured', detail: 'no Google credentials available' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(vertexUrl(project, location), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: GENERATION_CONFIG,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = `HTTP ${response.status}`;
      logger.warn('vertex call failed', { reason: 'upstream_error', detail });
      return { ok: false, reason: 'upstream_error', detail };
    }

    const text = extractVertexText(await response.json());
    if (text.length === 0) {
      return { ok: false, reason: 'invalid_output', detail: 'model returned empty text' };
    }
    return { ok: true, value: text };
  } catch (error) {
    // AbortController fires an AbortError when the deadline passes.
    const reason: AiFailureReason =
      error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'upstream_error';
    logger.warn('vertex call failed', { reason, detail: describeError(error) });
    return { ok: false, reason, detail: describeError(error) };
  } finally {
    clearTimeout(timer);
  }
}

/** Calls Gemini and validates the response against a schema. Never throws. */
export async function generateJson<T>(
  prompt: string,
  schema: z.ZodType<T>,
  timeoutMs: number = AI_TIMEOUT_MS,
): Promise<AiResult<T>> {
  const raw = await generateText(prompt, timeoutMs);
  if (!raw.ok) return raw;

  const json = extractJson(raw.value);
  if (json === null) {
    logger.warn('gemini returned no parseable JSON');
    return { ok: false, reason: 'invalid_output', detail: 'no JSON object in response' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    logger.warn('gemini returned malformed JSON', { detail: describeError(error) });
    return { ok: false, reason: 'invalid_output', detail: 'malformed JSON' };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    // The model produced JSON of the wrong shape. Refusing it is the whole
    // point: downstream code is typed against the schema, not against hope.
    const detail = result.error.issues.map((i) => i.path.join('.')).join(', ');
    logger.warn('gemini output failed schema validation', { detail });
    return { ok: false, reason: 'invalid_output', detail: `schema mismatch: ${detail}` };
  }

  return { ok: true, value: result.data };
}

/** Resets the memoised auth client. Test-only seam. */
export function resetAiClient(): void {
  cachedAuth = null;
}
