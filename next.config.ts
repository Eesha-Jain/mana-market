import type { NextConfig } from 'next';

/**
 * NEXT_APP_* is the source name in .env / Vercel.
 * Next.js only inlines NEXT_PUBLIC_* into the browser bundle, so we map at build time.
 */
function mapPublicEnv(name: string): string {
  return (
    process.env[`NEXT_APP_${name}`]?.trim()
    || process.env[`NEXT_PUBLIC_${name}`]?.trim()
    || ''
  );
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: mapPublicEnv('SUPABASE_URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: mapPublicEnv('SUPABASE_ANON_KEY'),
  },
};

export default nextConfig;
