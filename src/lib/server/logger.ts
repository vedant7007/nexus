/**
 * @module server/logger
 *
 * Responsibility: structured, JSON-line logging for Cloud Logging.
 *
 * The only module permitted to touch the console (enforced by ESLint). Cloud
 * Run parses stdout as JSON lines, so `severity` and `message` are named to
 * match its expectations and everything else rides along as structured context.
 *
 * Logging is deliberately dumb: no transports, no buffering, no PII scrubbing
 * magic. Callers pass what is safe to record.
 */

/** Cloud Logging severity levels used by this app. */
type Severity = 'INFO' | 'WARNING' | 'ERROR';

/** Structured context attached to a log line. */
export type LogContext = Record<string, string | number | boolean | null | undefined>;

/**
 * Writes one structured JSON line.
 *
 * @param severity - Cloud Logging severity.
 * @param message - Human-readable summary.
 * @param context - Structured fields. Must not contain secrets or PII.
 */
function write(severity: Severity, message: string, context?: LogContext): void {
  const line = JSON.stringify({ severity, message, ...context });
  if (severity === 'ERROR') {
    console.error(line);
  } else {
    console.log(line);
  }
}

/**
 * Reduces an unknown thrown value to a safe, loggable string.
 *
 * Deliberately drops the stack: this string may be attached to a log line that
 * is aggregated and shared, and a stack adds noise without adding diagnosis for
 * the failures we actually log (an upstream timeout, a schema mismatch).
 *
 * @param error - The caught value.
 * @returns A short description of the failure.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return typeof error === 'string' ? error : 'unknown error';
}

export const logger = {
  /** @param message - Summary. @param context - Structured fields. */
  info: (message: string, context?: LogContext): void => write('INFO', message, context),
  /** @param message - Summary. @param context - Structured fields. */
  warn: (message: string, context?: LogContext): void => write('WARNING', message, context),
  /** @param message - Summary. @param context - Structured fields. */
  error: (message: string, context?: LogContext): void => write('ERROR', message, context),
};
