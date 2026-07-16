/**
 * @vitest-environment node
 *
 * serverConfig() intentionally throws when `window` exists, so these tests must
 * run in a real server-like environment rather than jsdom.
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
  AI_RATE_LIMIT_PER_MIN,
  AI_TIMEOUT_MS,
  GEMINI_MODEL,
  isAiConfigured,
  isFirebaseConfigured,
  resetConfigCache,
  serverConfig,
} from '@/lib/config';

describe('config', () => {
  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    delete process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    delete process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
    resetConfigCache();
  });

  it('pins the Gemini model to 2.5-flash', () => {
    // 1.5-flash is retired and returns 404 — regression guard.
    expect(GEMINI_MODEL).toBe('gemini-2.5-flash');
  });

  it('exposes sane AI guard rails', () => {
    expect(AI_TIMEOUT_MS).toBeLessThanOrEqual(5_000);
    expect(AI_RATE_LIMIT_PER_MIN).toBeGreaterThan(0);
  });

  it('parses server config without a Gemini key, so rule-based mode is valid', () => {
    resetConfigCache();
    expect(() => serverConfig()).not.toThrow();
    expect(isAiConfigured()).toBe(false);
  });

  it('reports AI as configured once a key is present', () => {
    process.env.GEMINI_API_KEY = 'test-key';
    resetConfigCache();
    expect(isAiConfigured()).toBe(true);
  });

  it('reports Firebase as unconfigured when web config fields are missing', () => {
    expect(isFirebaseConfigured()).toBe(false);
  });

  it('reports Firebase as configured when every required field is present', () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'k';
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'd';
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'p';
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'a';
    expect(isFirebaseConfigured()).toBe(true);
  });

  it('memoises server config', () => {
    resetConfigCache();
    expect(serverConfig()).toBe(serverConfig());
  });
});
