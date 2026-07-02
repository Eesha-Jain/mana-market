/** Public env vars — supports NEXT_PUBLIC_* (Next.js) and legacy VITE_* names. */
export function publicEnv(name: string): string {
  const nextKey = `NEXT_PUBLIC_${name}` as keyof NodeJS.ProcessEnv;
  const viteKey = `VITE_${name}` as keyof NodeJS.ProcessEnv;
  return process.env[nextKey]?.trim() || process.env[viteKey]?.trim() || '';
}
