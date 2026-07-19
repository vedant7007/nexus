// The only module permitted to touch the console (enforced by ESLint). Cloud
// Run parses stdout as JSON lines, so `severity` and `message` are named to
// match its expectations and everything else rides along as structured context.

type Severity = 'INFO' | 'WARNING' | 'ERROR';

/** Structured context attached to a log line. */
export type LogContext = Record<string, string | number | boolean | null | undefined>;

// context must not contain secrets or PII.
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
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return typeof error === 'string' ? error : 'unknown error';
}

export const logger = {
  info: (message: string, context?: LogContext): void => write('INFO', message, context),
  warn: (message: string, context?: LogContext): void => write('WARNING', message, context),
  error: (message: string, context?: LogContext): void => write('ERROR', message, context),
};
