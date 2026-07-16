/**
 * @module server/errors
 *
 * Responsibility: a single, typed vocabulary for failure across the API.
 *
 * Routes never throw raw errors at the client. Every failure is an `AppError`
 * with a stable machine-readable code, an operator-safe message, and an HTTP
 * status. Anything else that escapes is treated as an unknown internal error and
 * reported as a bare 500 — the original is logged server-side, never serialised
 * to the response, so a stack trace or a driver message can't leak.
 */

/** Stable, machine-readable error codes returned to clients. */
export type ErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid_request'
  | 'not_found'
  | 'rate_limited'
  | 'upstream_unavailable'
  | 'internal';

/** Per-field validation messages, keyed by field path. */
export type FieldErrors = Record<string, string[]>;

/** The wire shape of every error response. */
export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    fields?: FieldErrors;
  };
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  invalid_request: 400,
  not_found: 404,
  rate_limited: 429,
  upstream_unavailable: 503,
  internal: 500,
};

/**
 * An error that is safe to show a client.
 *
 * Constructing one is an assertion that `message` contains no internal detail.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: FieldErrors;

  /**
   * @param code - Stable error code.
   * @param message - Operator-safe message. Must not contain internal detail.
   * @param fields - Optional per-field validation messages.
   */
  constructor(code: ErrorCode, message: string, fields?: FieldErrors) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    if (fields !== undefined) this.fields = fields;
  }

  /**
   * Serialises to the wire error shape.
   *
   * @returns The response body.
   */
  toBody(): ErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields === undefined ? {} : { fields: this.fields }),
      },
    };
  }
}

/** @returns A 401 error. */
export const unauthenticated = (message = 'Authentication required.'): AppError =>
  new AppError('unauthenticated', message);

/** @returns A 400 error carrying per-field validation messages. */
export const invalidRequest = (message: string, fields?: FieldErrors): AppError =>
  new AppError('invalid_request', message, fields);

/** @returns A 404 error. */
export const notFound = (message = 'Not found.'): AppError => new AppError('not_found', message);

/** @returns A 429 error. */
export const rateLimited = (message = 'Too many requests. Please slow down.'): AppError =>
  new AppError('rate_limited', message);

/**
 * Narrows an unknown thrown value to an AppError.
 *
 * @param value - The caught value.
 * @returns True when the value is an AppError.
 */
export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
