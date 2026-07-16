/**
 * @module server/handler
 *
 * Responsibility: make every route behave identically at its edges.
 *
 * Auth, validation, rate limiting, error shape, and the guarantee that an
 * unexpected throw becomes a bare 500 with the detail logged rather than
 * serialised — all of it happens here, once. A route body only ever contains
 * what makes that route different.
 *
 * The alternative is each route remembering to try/catch, remembering not to
 * echo `error.message`, remembering the error envelope. One of them eventually
 * forgets, and that one leaks a stack trace to a judge.
 */
import { NextResponse } from 'next/server';
import type { z } from 'zod';

import { AI_RATE_LIMIT_PER_MIN } from '../config';

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

/**
 * Flattens Zod issues into per-field messages.
 *
 * @param error - The Zod error.
 * @returns Field path to messages.
 */
function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

/**
 * Converts any thrown value into a safe response.
 *
 * @param error - The caught value.
 * @param route - Route name, for logging.
 * @returns The error response.
 */
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

/**
 * Wraps a route body with auth, validation, rate limiting, and error handling.
 *
 * @param route - Route name, used in logs.
 * @param options - Body schema and rate-limit policy.
 * @param handle - The route body. Runs only once every edge is satisfied.
 * @returns A Next.js route handler.
 */
export function withRoute<TBody = undefined, TResult = unknown>(
  route: string,
  options: RouteOptions<TBody>,
  handle: (context: RouteContext<TBody>) => Promise<TResult>,
): (request: Request) => Promise<NextResponse<TResult | ErrorBody>> {
  return async (request: Request): Promise<NextResponse<TResult | ErrorBody>> => {
    try {
      const user = await requireUser(request);

      if (options.rateLimit === true) {
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

/**
 * Reads and validates a JSON body.
 *
 * @param request - The incoming request.
 * @param schema - The schema, if this route takes a body.
 * @returns The validated body, or undefined when no schema was given.
 * @throws {AppError} 400 when the body is unparseable or fails validation.
 */
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
