// Imported only by the auth provider, so Firebase stays out of the bundle for
// pages that do not need it — the public landing page must not pay ~40 kB.
import { type FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, getAuth } from 'firebase/auth';

import { clientConfig, isFirebaseConfigured } from '../config';

let cachedApp: FirebaseApp | null = null;

// Initialises the app once. Null when Firebase is not configured — a supported
// state locally, not an error.
function getApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (cachedApp !== null) return cachedApp;

  const existing = getApps()[0];
  cachedApp = existing ?? initializeApp(clientConfig());
  return cachedApp;
}

/** The Auth instance, or null when Firebase is not configured. */
export function getAuthClient(): Auth | null {
  const app = getApp();
  return app === null ? null : getAuth(app);
}
