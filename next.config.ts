import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin the workspace root (a stray lockfile lives higher up under the home dir).
  turbopack: { root: process.cwd() },
  images: {
    // Product/variant images are admin-supplied URLs (+ placeholders in dev).
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

export default nextConfig;
