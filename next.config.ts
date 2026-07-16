import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cloud Run runs the app from a minimal container; 'standalone' emits a
  // self-contained server bundle so the image does not need node_modules.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    // Lint runs as its own CI gate; keeping it out of `next build` keeps
    // container builds fast and failures attributable to a single step.
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Charts are heavy and only used on the dashboard; keep them out of the
    // shared bundle so public pages stay within the performance budget.
    optimizePackageImports: ['recharts', 'firebase'],
  },
};

export default nextConfig;
