import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: 'NEXUS — AI Command Center for Stadium Operations',
    template: '%s · NEXUS',
  },
  description:
    'NEXUS turns live stadium operations data into plain-language situational awareness, ' +
    'AI decision recommendations with reasoning, and multilingual incident triage.',
  applicationName: 'NEXUS',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#06080d',
  width: 'device-width',
  initialScale: 1,
};

/**
 * The root layout.
 *
 * Reading `headers()` here is load-bearing, not incidental. The middleware
 * issues a per-request CSP nonce, and a nonce cannot exist in a page that was
 * rendered once at build time — so with static prerendering the browser refused
 * every one of Next's own scripts and the app shipped with no JavaScript at all.
 * Touching `headers()` opts the tree into dynamic rendering, which is what lets
 * Next stamp the nonce onto its script tags.
 *
 * The cost is that no page is statically prerendered. That is the correct trade
 * here: this is an authenticated operations console behind `min-instances=1`, so
 * there is no cold start to amortise and nothing worth caching at the edge —
 * every page shows live state anyway.
 *
 * @param props - Standard children.
 * @returns The document shell.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The value is unused; the read is what forces dynamic rendering.
  await headers();

  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
