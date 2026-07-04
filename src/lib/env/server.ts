import 'server-only';

/** Server-only secrets — pass exact process.env key names. */
export function serverEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return '';
}
