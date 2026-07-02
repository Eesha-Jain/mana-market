/** Public env vars — supports NEXT_PUBLIC_<name> */
export function publicEnv(name: string): string {
  const nextKey = `NEXT_PUBLIC_${name}` as keyof NodeJS.ProcessEnv;
  return process.env[nextKey]?.trim() || '';
}
