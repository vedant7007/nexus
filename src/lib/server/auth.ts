/**
 * @module server/auth
 *
 * Responsibility: establish who is making a request, or refuse it.
 *
 * NEXUS is an operations tool: every route is behind auth, and there is no
 * anonymous read path. The client sends a Firebase ID token as a bearer token
 * and the Admin SDK verifies its signature and expiry server-side. A token is
 * never trusted because it looks well-formed.
 */
import { getAuth } from 'firebase-admin/auth';

import { isFirebaseConfigured, serverConfig } from '../config';

import { unauthenticated } from './errors';
import { getDb } from './firestoreRepository';
import { describeError, logger } from './logger';

/** The authenticated caller. */
export interface AuthedUser {
  uid: string;
  email: string | undefined;
}

/**
 * Extracts a bearer token from an Authorization header.
 *
 * @param header - The raw header value, if present.
 * @returns The token, or null when the header is missing or malformed.
 */
export function parseBearer(header: string | null): string | null {
  if (header === null) return null;

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token === undefined || token.length === 0 ? null : token;
}

/**
 * Verifies the caller's Firebase ID token.
 *
 * @param request - The incoming request.
 * @returns The authenticated user.
 * @throws {AppError} 401 when the token is missing, malformed, or invalid.
 */
export async function requireUser(request: Request): Promise<AuthedUser> {
  const token = parseBearer(request.headers.get('authorization'));
  if (token === null) throw unauthenticated('Missing bearer token.');

  const config = serverConfig();

  // Two ways the token check is skipped, both safe:
  //  1. The E2E harness sets AUTH_BYPASS=1 explicitly. Opt-in and named; no real
  //     deploy sets it.
  //  2. Local development with no Firebase project at all — but never in
  //     production, so a deployed revision that forgot its Firebase config fails
  //     closed rather than open.
  // A test pins that neither path fires for a production request lacking the flag.
  const devBypass = !isFirebaseConfigured() && config.NODE_ENV !== 'production';
  if (config.AUTH_BYPASS || devBypass) {
    logger.warn('auth bypassed', {
      reason: config.AUTH_BYPASS ? 'AUTH_BYPASS flag' : 'no Firebase (dev)',
    });
    return { uid: `dev-${token.slice(0, 8)}`, email: undefined };
  }

  try {
    // Touch the app so the Admin SDK is initialised before getAuth().
    getDb();
    const decoded = await getAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch (error) {
    // The reason a token failed is useful to us and useful to an attacker, so
    // it is logged and not returned.
    logger.warn('token verification failed', { detail: describeError(error) });
    throw unauthenticated('Invalid or expired session. Please sign in again.');
  }
}
