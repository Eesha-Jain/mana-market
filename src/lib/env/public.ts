/** Client-readable env vars (set NEXT_APP_* in .env / Vercel; mapped via next.config.ts). */
export function publicEnv(name: string): string {
  const nextPublic = `NEXT_PUBLIC_${name}` as keyof NodeJS.ProcessEnv;
  const nextApp = `NEXT_APP_${name}` as keyof NodeJS.ProcessEnv;
  return process.env[nextPublic]?.trim() || process.env[nextApp]?.trim() || '';
}
