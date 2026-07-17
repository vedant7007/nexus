/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetConfigCache } from '@/lib/config';

const verifyIdToken = vi.hoisted(() => vi.fn());

vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken }) }));
vi.mock('@/lib/server/firestoreRepository', () => ({
  getDb: vi.fn(),
  FirestoreIncidentRepository: class {},
}));

const { parseBearer, requireUser } = await import('@/lib/server/auth');

const ORIGINAL_ENV = process.env.NODE_ENV;

/** Builds a request with the given Authorization header. */
function withAuth(value?: string): Request {
  return new Request('http://t/x', {
    headers: value === undefined ? {} : { authorization: value },
  });
}

/** Sets NODE_ENV, which is readonly in types but writable at runtime. */
function setNodeEnv(value: string): void {
  (process.env as Record<string, string>).NODE_ENV = value;
  resetConfigCache();
}

beforeEach(() => {
  verifyIdToken.mockReset();
  resetConfigCache();
});

afterEach(() => {
  setNodeEnv(ORIGINAL_ENV ?? 'test');
  for (const key of [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ]) {
    delete process.env[key];
  }
  resetConfigCache();
  vi.restoreAllMocks();
});

describe('parseBearer', () => {
  it('extracts a bearer token', () => {
    expect(parseBearer('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('is case-insensitive on the scheme', () => {
    expect(parseBearer('bearer abc')).toBe('abc');
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseBearer('  Bearer   abc  ')).toBe('abc');
  });

  it.each([
    ['missing header', null],
    ['wrong scheme', 'Basic abc'],
    ['no token', 'Bearer'],
    ['empty token', 'Bearer    '],
    ['empty string', ''],
  ])('returns null for %s', (_name, header) => {
    expect(parseBearer(header)).toBeNull();
  });
});

describe('requireUser', () => {
  it('rejects a request with no token', async () => {
    await expect(requireUser(withAuth())).rejects.toMatchObject({ status: 401 });
  });

  /**
   * The bypass exists so the app runs locally with no Firebase project. This
   * test is the thing standing between that convenience and an unauthenticated
   * production deployment.
   */
  it('never bypasses auth in production, even with Firebase unconfigured', async () => {
    setNodeEnv('production');
    verifyIdToken.mockRejectedValue(new Error('no project configured'));

    await expect(requireUser(withAuth('Bearer anything'))).rejects.toMatchObject({
      status: 401,
      code: 'unauthenticated',
    });
  });

  it('allows a dev bypass outside production when Firebase is unconfigured', async () => {
    setNodeEnv('development');

    const user = await requireUser(withAuth('Bearer localdevtoken'));
    expect(user.uid).toMatch(/^dev-/);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('honours an explicit AUTH_BYPASS even in production, for the E2E build', async () => {
    setNodeEnv('production');
    process.env.AUTH_BYPASS = '1';
    resetConfigCache();

    const user = await requireUser(withAuth('Bearer e2e'));
    expect(user.uid).toMatch(/^dev-/);
    expect(verifyIdToken).not.toHaveBeenCalled();

    delete process.env.AUTH_BYPASS;
    resetConfigCache();
  });

  it('does not bypass in production when AUTH_BYPASS is unset or off', async () => {
    setNodeEnv('production');
    process.env.AUTH_BYPASS = '0';
    resetConfigCache();
    verifyIdToken.mockRejectedValue(new Error('no project'));

    await expect(requireUser(withAuth('Bearer x'))).rejects.toMatchObject({ status: 401 });

    delete process.env.AUTH_BYPASS;
    resetConfigCache();
  });

  it('verifies the token against Firebase once configured', async () => {
    setNodeEnv('development');
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'k';
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'd';
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'p';
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'a';
    resetConfigCache();
    verifyIdToken.mockResolvedValue({ uid: 'real-uid', email: 'ops@stadium.example' });

    const user = await requireUser(withAuth('Bearer real.token'));

    expect(verifyIdToken).toHaveBeenCalledWith('real.token');
    expect(user).toEqual({ uid: 'real-uid', email: 'ops@stadium.example' });
  });

  it('rejects an expired or forged token', async () => {
    setNodeEnv('production');
    verifyIdToken.mockRejectedValue(new Error('Firebase ID token has expired'));

    await expect(requireUser(withAuth('Bearer stale'))).rejects.toMatchObject({ status: 401 });
  });

  it('never echoes the verification failure reason to the client', async () => {
    setNodeEnv('production');
    verifyIdToken.mockRejectedValue(new Error('kid mismatch: internal key rotation detail'));

    await expect(requireUser(withAuth('Bearer x'))).rejects.toMatchObject({
      message: 'Invalid or expired session. Please sign in again.',
    });
  });
});
