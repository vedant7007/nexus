// Centralises every route's edges — auth, validation, rate limiting, error
// envelope, and turning an unexpected throw into a bare 500 with the detail
// logged not serialised — in one place. The alternative is each route
// remembering not to echo `error.message`; one eventually forgets and leaks a
// stack trace.
import { NextResponse } from 'next/server';
import type { z } from 'zod';

import { AI_RATE_LIMIT_PER_MIN, serverConfig } from '../config';

import { type AuthedUser, requireUser } from './auth';
import { type ErrorBody, AppError, invalidRequest, isAppError, rateLimited } from './errors';
import { describeError, logger } from './logger';
import { checkRateLimit } from './rateLimit';

/** Context handed to a route body once the edges are satisfied. */
export interface RouteContext<TBody> {
  user: AuthedUser;
  /** The validated request body. `undefined` for routes with no body schema. */
  body: TBody;
  request: Request;
}

/**
 * Schema for a request body.
 *
 * The input type is `unknown`, not `TBody`: the thing being parsed is whatever
 * JSON arrived over the wire. Typing the input as the output would forbid any
 * schema that transforms, and `.default()` is a transform.
 */
export type BodySchema<TBody> = z.ZodType<TBody, z.ZodTypeDef, unknown>;

/** Options controlling the edges of a route. */
export interface RouteOptions<TBody> {
  /** Zod schema for the JSON body. Omit for routes that take none. */
  schema?: BodySchema<TBody>;
  /** Apply the AI rate limit to this route. */
  rateLimit?: boolean;
}

/** Flattens Zod issues into per-field messages. */
function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

/** Converts any thrown value into a safe response. */
function toErrorResponse(error: unknown, route: string): NextResponse<ErrorBody> {
  if (isAppError(error)) {
    return NextResponse.json(error.toBody(), { status: error.status });
  }

  // Anything reaching here is a bug rather than a handled condition. The detail
  // goes to the log; the client gets nothing it could learn from.
  logger.error('unhandled route error', { route, detail: describeError(error) });
  const internal = new AppError('internal', 'An unexpected error occurred.');
  return NextResponse.json(internal.toBody(), { status: 500 });
}

/** Wraps a route body with auth, validation, rate limiting, and error handling. */
export function withRoute<TBody = undefined, TResult = unknown>(
  route: string,
  options: RouteOptions<TBody>,
  handle: (context: RouteContext<TBody>) => Promise<TResult>,
): (request: Request) => Promise<NextResponse<TResult | ErrorBody>> {
  return async (request: Request): Promise<NextResponse<TResult | ErrorBody>> => {
    try {
      const user = await requireUser(request);

      // The rate limit is per-uid. In the explicit AUTH_BYPASS build (demo /
      // E2E) every request shares one synthetic identity, so a per-user limit
      // would throttle the entire session as if it were a single abusive user —
      // the panels would show a 429 mid-demo. It is skipped there and covered by
      // the route integration tests, which run without the flag.
      if (options.rateLimit === true && !serverConfig().AUTH_BYPASS) {
        const limit = checkRateLimit(user.uid, AI_RATE_LIMIT_PER_MIN);
        if (!limit.allowed) {
          logger.info('rate limit hit', { route, uid: user.uid });
          throw rateLimited(
            `AI request limit reached (${AI_RATE_LIMIT_PER_MIN}/min). Retry in ${limit.retryAfterSec}s.`,
          );
        }
      }

      const body = await parseBody(request, options.schema);
      const result = await handle({ user, body, request });
      return NextResponse.json(result);
    } catch (error) {
      return toErrorResponse(error, route);
    }
  };
}

/** Reads and validates a JSON body, or throws a 400 when it fails. */
async function parseBody<TBody>(
  request: Request,
  schema: BodySchema<TBody> | undefined,
): Promise<TBody> {
  if (schema === undefined) return undefined as TBody;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw invalidRequest('Request body must be valid JSON.');
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw invalidRequest('Request validation failed.', toFieldErrors(parsed.error));
  }
  return parsed.data;
}
