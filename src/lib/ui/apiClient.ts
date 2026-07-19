/**
 * The browser's only door to the API. Two rules keep `any` out of the UI layer:
 *
 *  1. **Every response is parsed with a Zod schema before it is returned.** A
 *     `fetch().json()` is `any` by definition; letting that spread into
 *     components is how a codebase quietly loses its types. Parsing at the door
 *     means everything downstream is genuinely typed, not just annotated.
 *  2. **Errors are values.** Callers get a discriminated result and the type
 *     system makes them handle the failure case, which is how every panel ends
 *     up with a real error state instead of a spinner that never stops.
 */
import { z } from 'zod';

/** A failed request, in a shape the UI can render. */
export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string[]>;
}

/** The result of an API call. Never throws. */
export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: ApiError };

/** The server's error envelope. */
const errorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.array(z.string())).optional(),
  }),
});

/** Shown when the network fails outright, rather than the server refusing. */
const NETWORK_ERROR: ApiError = {
  code: 'network',
  message: 'Could not reach the server. Check your connection and retry.',
};

/** Shown when the server answers with something we cannot interpret. */
const MALFORMED_ERROR: ApiError = {
  code: 'malformed_response',
  message: 'The server returned an unexpected response.',
};

/** Supplies the caller's Firebase ID token, or null when signed out. */
export type TokenProvider = () => Promise<string | null>;

/** Options for a request. */
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  signal?: AbortSignal;
}

// Interprets a non-OK response into a renderable error.
async function toApiError(response: Response): Promise<ApiError> {
  try {
    const parsed = errorBodySchema.safeParse(await response.json());
    if (parsed.success) return parsed.data.error;
  } catch {
    // Body was not JSON. Fall through to the generic message rather than
    // surfacing a parse exception to a control-room operator.
  }
  return { code: 'http_error', message: `Request failed (${response.status}).` };
}

/** Calls the API and validates the response against a schema. Never throws. */
export async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  getToken: TokenProvider,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const token = await getToken();
  if (token === null) {
    return {
      ok: false,
      error: { code: 'unauthenticated', message: 'Please sign in to continue.' },
    };
  }

  const response = await send(path, token, options);
  if (response === null) return { ok: false, error: NETWORK_ERROR };
  if (!response.ok) return { ok: false, error: await toApiError(response) };

  return parseBody(response, schema);
}

// Returns null when the network failed. Re-throws a DOMException on abort so the
// caller's effect can ignore it.
async function send(
  path: string,
  token: string,
  options: RequestOptions,
): Promise<Response | null> {
  const hasBody = options.body !== undefined;

  try {
    return await fetch(path, {
      method: options.method ?? 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        ...(hasBody ? { 'content-type': 'application/json' } : {}),
      },
      ...(hasBody ? { body: JSON.stringify(options.body) } : {}),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
  } catch (error) {
    // An aborted request is a normal part of React's lifecycle, not a failure
    // worth showing anyone. Re-throw so the caller's effect can ignore it.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return null;
  }
}

// Reads and validates a successful response body against the schema.
async function parseBody<T>(
  response: Response,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): Promise<ApiResult<T>> {
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return { ok: false, error: MALFORMED_ERROR };
  }

  const parsed = schema.safeParse(raw);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: MALFORMED_ERROR };
}
