import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/dashboard', destination: '/manage', permanent: true },
      { source: '/review', destination: '/manage', permanent: true },
    ];
  },
};

export default nextConfig;
