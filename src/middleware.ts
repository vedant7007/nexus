// A per-request nonce is threaded into the CSP so the inline scripts Next.js
// emits are allowed without 'unsafe-inline'. The nonce is passed to the app via
// a request header, which Next reads to stamp its own script tags.
import { type NextRequest, NextResponse } from 'next/server';

/** Hosts the Firebase web SDK must reach for auth and Firestore. */
const FIREBASE_ORIGINS = [
  'https://*.googleapis.com',
  'https://*.firebaseio.com',
  'https://securetoken.googleapis.com',
  'https://identitytoolkit.googleapis.com',
];

// isDev relaxes script-src because Next's HMR needs eval in development.
function buildCsp(nonce: string, isDev: boolean): string {
  const scriptSrc = isDev
    ? `'self' 'unsafe-inline' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    // Tailwind and Radix inject style attributes at runtime; a nonce cannot
    // cover those, so inline styles are permitted while scripts are not.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' ${FIREBASE_ORIGINS.join(' ')}`,
    `frame-src 'self' https://*.firebaseapp.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

export function middleware(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set('Content-Security-Policy', buildCsp(nonce, isDev));
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  );
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('X-DNS-Prefetch-Control', 'off');

  return response;
}

export const config = {
  matcher: [
    // Static assets are immutable and served from the CDN; skipping them keeps
    // middleware off the hot path without losing coverage of real documents.
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
