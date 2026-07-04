/**
 * Client-readable env vars (set NEXT_PUBLIC_* in .env / Vercel).
 *
 * Use static `process.env.NEXT_PUBLIC_*` access so Next.js can inline values in the
 * browser bundle. Dynamic `process.env[variable]` is not replaced at build time.
 */
export function publicEnv(name: 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'): string;
export function publicEnv(name: string): string;
export function publicEnv(name: string): string {
  switch (name) {
    case 'SUPABASE_URL':
      return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
    case 'SUPABASE_ANON_KEY':
      return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
    default:
      return '';
  }
}
