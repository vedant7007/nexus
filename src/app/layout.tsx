import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
