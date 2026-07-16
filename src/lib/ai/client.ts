/**
 * @module ai/client
 *
 * Responsibility: the only place that talks to Gemini, and the only place that
 * decides an AI call has failed.
 *
 * Every AI feature in NEXUS routes through {@link generateJson} or
 * {@link generateText}, which guarantee four things the rest of the app relies
 * on absolutely:
 *
 *  1. **A hard timeout.** A control room cannot wait on a hanging model. Four
 *     seconds, then we fall back.
 *  2. **No throwing.** Callers get a discriminated result, never an exception.
 *     A dead-ended AI panel is a product failure, so failure must be a value
 *     the caller is forced by the type system to handle.
 *  3. **Schema validation.** Model output is untrusted input. It is parsed with
 *     Zod before any caller sees it; a shape mismatch is a failure, not a
 *     surprise `undefined` three layers away.
 *  4. **Server-only.** The API key never reaches a bundle.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { z } from 'zod';

import { AI_TIMEOUT_MS, GEMINI_MODEL, serverConfig } from '../config';
import { describeError, logger } from '../server/logger';

/** Why an AI call did not produce usable output. */
export type AiFailureReason = 'not_configured' | 'timeout' | 'upstream_error' | 'invalid_output';

/** The result of an AI call. Failure is a value, never an exception. */
export type AiResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: AiFailureReason; detail: string };

let cachedClient: GoogleGenerativeAI | null = null;

/**
 * Lazily constructs the Gemini client.
 *
 * @returns The client, or null when no API key is configured.
 */
function getClient(): GoogleGenerativeAI | null {
  const { GEMINI_API_KEY } = serverConfig();
  if (GEMINI_API_KEY === undefined) return null;
  cachedClient ??= new GoogleGenerativeAI(GEMINI_API_KEY);
  return cachedClient;
}

/**
 * Races a promise against a timeout.
 *
 * @param promise - Work to bound.
 * @param ms - Timeout in milliseconds.
 * @returns The promise's value.
 * @throws {Error} With message 'timeout' when the deadline passes first.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), ms);
      }),
    ]);
  } finally {
    // Always clear: a dangling timer would keep the Node process alive past
    // the request and delay Cloud Run scaling the instance down.
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Extracts a JSON object from a model response.
 *
 * Models wrap JSON in ```json fences or prose despite instructions not to, so
 * strip fences and fall back to the outermost brace-delimited span. This is
 * tolerance for known formatting habits, not for invented content — the result
 * still has to satisfy the caller's schema.
 *
 * @param raw - Raw model text.
 * @returns The JSON substring, or null when none is present.
 */
export function extractJson(raw: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const body = (fenced?.[1] ?? raw).trim();

  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  return body.slice(start, end + 1);
}

/**
 * Calls Gemini and returns raw text.
 *
 * @param prompt - The full prompt.
 * @param timeoutMs - Deadline in milliseconds.
 * @returns The model's text, or a typed failure.
 */
export async function generateText(
  prompt: string,
  timeoutMs: number = AI_TIMEOUT_MS,
): Promise<AiResult<string>> {
  const client = getClient();
  if (client === null) {
    return { ok: false, reason: 'not_configured', detail: 'GEMINI_API_KEY is not set' };
  }

  try {
    const model = client.getGenerativeModel({ model: GEMINI_MODEL });
    const response = await withTimeout(model.generateContent(prompt), timeoutMs);
    const text = response.response.text().trim();

    if (text.length === 0) {
      return { ok: false, reason: 'invalid_output', detail: 'model returned empty text' };
    }
    return { ok: true, value: text };
  } catch (error) {
    const detail = describeError(error);
    const reason: AiFailureReason = detail.includes('timeout') ? 'timeout' : 'upstream_error';
    logger.warn('gemini call failed', { reason, detail });
    return { ok: false, reason, detail };
  }
}

/**
 * Calls Gemini and parses the response against a schema.
 *
 * @param prompt - The full prompt. Should instruct the model to return JSON.
 * @param schema - Zod schema the output must satisfy.
 * @param timeoutMs - Deadline in milliseconds.
 * @returns The validated value, or a typed failure. Never throws.
 */
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

/** Resets the memoised client. Test-only seam. */
export function resetAiClient(): void {
  cachedClient = null;
}
