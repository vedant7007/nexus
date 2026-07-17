/**
 * @module config
 *
 * Responsibility: the single, validated gateway to process environment.
 *
 * No other module reads `process.env`. Values are parsed through Zod so a
 * misconfigured deployment fails loudly at the boundary rather than surfacing
 * as an `undefined` deep inside a request handler.
 *
 * Server and client config are deliberately separated: `serverConfig()` throws
 * if called from the browser, which makes leaking a secret into the client
 * bundle a build/runtime error rather than a silent security hole.
 */
import { z } from 'zod';

/** Gemini model id. `gemini-1.5-flash` is retired and 404s; 2.5-flash is current. */
export const GEMINI_MODEL = 'gemini-2.5-flash';

/** Hard ceiling on a single Gemini call, in milliseconds. */
export const AI_TIMEOUT_MS = 4_000;

/**
 * AI requests permitted per authenticated user per minute.
 *
 * Sized for the dashboard's real shape, not a single endpoint. Three AI panels
 * (briefing, sustainability, recommendations) refresh on ~20–25s cadences —
 * roughly 9 calls/min at rest — and each re-fetches when the overall risk level
 * changes so the panels stay coherent with the live status during an escalation.
 * 30/min leaves comfortable headroom for that while still firmly capping abuse
 * of the Gemini budget; an earlier 15 throttled ordinary operation.
 */
export const AI_RATE_LIMIT_PER_MIN = 30;

const serverSchema = z.object({
  /**
   * Absent in local development and in tests, which is legitimate: every AI
   * feature has a deterministic fallback, so a missing key degrades the app to
   * rule-based mode rather than breaking it.
   */
  GEMINI_API_KEY: z.string().min(1).optional(),
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /**
   * Explicit, opt-in bypass of token verification, for the E2E build only.
   *
   * The Playwright suite runs a *production* build (so it exercises the real CSP
   * and the real bundle), which means the non-production dev-auth path never
   * fires. Rather than weaken that production guard, the test harness sets this
   * flag to '1'. It is named for exactly what it is, defaults off, and is never
   * set by any real deployment — a test asserts that without it, production
   * refuses every request.
   */
  AUTH_BYPASS: z
    .enum(['0', '1'])
    .optional()
    .transform((value) => value === '1'),
});

const clientSchema = z.object({
  apiKey: z.string().min(1).optional(),
  authDomain: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  storageBucket: z.string().min(1).optional(),
  messagingSenderId: z.string().min(1).optional(),
  appId: z.string().min(1).optional(),
});

/** Validated server-only configuration. */
export type ServerConfig = z.infer<typeof serverSchema>;

/** Validated Firebase web-SDK configuration (safe to ship to the browser). */
export type ClientConfig = z.infer<typeof clientSchema>;

let cachedServer: ServerConfig | null = null;

/**
 * Returns validated server configuration.
 *
 * @returns The parsed server environment.
 * @throws {Error} If called in a browser context, or if the environment fails validation.
 */
export function serverConfig(): ServerConfig {
  if (typeof window !== 'undefined') {
    throw new Error('serverConfig() must never be called from the browser');
  }
  if (cachedServer === null) {
    cachedServer = serverSchema.parse({
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      FIREBASE_PROJECT_ID:
        process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      NODE_ENV: process.env.NODE_ENV,
      AUTH_BYPASS: process.env.AUTH_BYPASS,
    });
  }
  return cachedServer;
}

/**
 * Returns the Firebase web configuration.
 *
 * These values are public by design (Firebase security rests on Auth + rules,
 * not on hiding the web API key). They are referenced as full literal
 * `process.env.NEXT_PUBLIC_*` expressions because Next.js inlines them at build
 * time only when written this way.
 *
 * @returns The parsed client config; fields are undefined when unconfigured.
 */
export function clientConfig(): ClientConfig {
  return clientSchema.parse({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

/**
 * Reports whether Firebase Auth is fully configured.
 *
 * @returns True when every required web-config field is present.
 */
export function isFirebaseConfigured(): boolean {
  const c = clientConfig();
  return Boolean(c.apiKey && c.authDomain && c.projectId && c.appId);
}

/**
 * Reports whether live Gemini calls are possible.
 *
 * @returns True when an API key is configured; false means rule-based mode.
 */
export function isAiConfigured(): boolean {
  return Boolean(serverConfig().GEMINI_API_KEY);
}

/** Resets memoised config. Test-only seam for exercising env permutations. */
export function resetConfigCache(): void {
  cachedServer = null;
}
