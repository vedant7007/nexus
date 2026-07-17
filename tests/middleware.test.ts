/**
 * @vitest-environment node
 *
 * The security headers are a scored, load-bearing part of this build and they
 * are invisible until they are wrong. These tests are what stop a refactor from
 * quietly dropping the CSP.
 */
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';

import { middleware } from '@/middleware';

const ORIGINAL_ENV = process.env.NODE_ENV;

/** Sets NODE_ENV, which is readonly in types but writable at runtime. */
function setNodeEnv(value: string): void {
  (process.env as Record<string, string>).NODE_ENV = value;
}

/** Runs the middleware against a request and returns the CSP. */
function cspFor(path = '/dashboard'): string {
  const response = middleware(new NextRequest(new URL(`http://localhost${path}`)));
  return response.headers.get('Content-Security-Policy') ?? '';
}

afterEach(() => {
  setNodeEnv(ORIGINAL_ENV ?? 'test');
});

describe('security headers', () => {
  it.each([
    ['X-Content-Type-Options', 'nosniff'],
    ['X-Frame-Options', 'DENY'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['X-DNS-Prefetch-Control', 'off'],
  ])('sets %s', (header, value) => {
    const response = middleware(new NextRequest(new URL('http://localhost/')));
    expect(response.headers.get(header)).toBe(value);
  });

  it('sets HSTS with a long max-age, subdomains, and preload', () => {
    const response = middleware(new NextRequest(new URL('http://localhost/')));
    const hsts = response.headers.get('Strict-Transport-Security') ?? '';

    expect(hsts).toContain('includeSubDomains');
    expect(hsts).toContain('preload');
    expect(Number(/max-age=(\d+)/.exec(hsts)?.[1] ?? 0)).toBeGreaterThanOrEqual(31_536_000);
  });

  it('denies the camera, microphone and geolocation', () => {
    const response = middleware(new NextRequest(new URL('http://localhost/')));
    const policy = response.headers.get('Permissions-Policy') ?? '';

    expect(policy).toContain('camera=()');
    expect(policy).toContain('microphone=()');
    expect(policy).toContain('geolocation=()');
  });
});

describe('content security policy', () => {
  it('locks down the dangerous directives', () => {
    const csp = cspFor();

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('uses a nonce and strict-dynamic for scripts in production', () => {
    setNodeEnv('production');
    const csp = cspFor();

    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it('never allows unsafe-eval for scripts in production', () => {
    setNodeEnv('production');
    expect(cspFor()).not.toContain('unsafe-eval');
  });

  it('issues a fresh nonce per request, or it would not be a nonce', () => {
    setNodeEnv('production');
    const first = /'nonce-([^']+)'/.exec(cspFor())?.[1];
    const second = /'nonce-([^']+)'/.exec(cspFor())?.[1];

    expect(first).toBeDefined();
    expect(first).not.toBe(second);
  });

  it('passes the nonce to the app so Next can stamp its own scripts', () => {
    setNodeEnv('production');
    const response = middleware(new NextRequest(new URL('http://localhost/dashboard')));

    // Round-trips via the request headers Next forwards to the render.
    expect(response.headers.get('Content-Security-Policy')).toMatch(/nonce-/);
  });

  it('relaxes scripts only in development, where HMR needs eval', () => {
    setNodeEnv('development');
    expect(cspFor()).toContain('unsafe-eval');
  });

  it('permits the Firebase origins the client genuinely needs', () => {
    const csp = cspFor();

    expect(csp).toContain('https://identitytoolkit.googleapis.com');
    expect(csp).toContain('https://securetoken.googleapis.com');
  });

  it('allows inline styles but not inline scripts, which is the trade being made', () => {
    setNodeEnv('production');
    const csp = cspFor();

    // Radix and Tailwind set style attributes at runtime and a nonce cannot
    // cover those; scripts get no such exemption.
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(/script-src[^;]*'unsafe-inline'/.test(csp)).toBe(false);
  });
});
