/**
 * @module ui/firebaseClient
 *
 * Responsibility: the browser's Firebase Auth instance, and nothing else.
 *
 * Imported only by the auth provider, so Firebase stays out of the bundle for
 * pages that do not need it. The public landing page must not pay ~40 kB to
 * render a headline.
 */
import { type FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, getAuth } from 'firebase/auth';

import { clientConfig, isFirebaseConfigured } from '../config';

let cachedApp: FirebaseApp | null = null;

/**
 * Returns the Firebase app, initialising it once.
 *
 * @returns The app, or null when Firebase is not configured — which is a
 *   supported state locally, not an error.
 */
function getApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (cachedApp !== null) return cachedApp;

  const existing = getApps()[0];
  cachedApp = existing ?? initializeApp(clientConfig());
  return cachedApp;
}

/**
 * Returns the Auth instance.
 *
 * @returns The instance, or null when Firebase is not configured.
 */
export function getAuthClient(): Auth | null {
  const app = getApp();
  return app === null ? null : getAuth(app);
}
