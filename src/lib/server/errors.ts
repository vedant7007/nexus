// Typed failure vocabulary for the API. Anything that is not an AppError is
// reported as a bare 500 and logged server-side, never serialised to the
// response, so a stack trace or driver message can't leak.

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

  constructor(code: ErrorCode, message: string, fields?: FieldErrors) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    if (fields !== undefined) this.fields = fields;
  }

  /** Serialises to the wire error shape. */
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

export const unauthenticated = (message = 'Authentication required.'): AppError =>
  new AppError('unauthenticated', message);

/** A 400 error carrying per-field validation messages. */
export const invalidRequest = (message: string, fields?: FieldErrors): AppError =>
  new AppError('invalid_request', message, fields);

export const notFound = (message = 'Not found.'): AppError => new AppError('not_found', message);

export const rateLimited = (message = 'Too many requests. Please slow down.'): AppError =>
  new AppError('rate_limited', message);

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
