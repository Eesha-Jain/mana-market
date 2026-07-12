export function formatPersistenceError(
  err: unknown,
  action: string,
  suffix = '.',
): string {
  const detail = err instanceof Error ? err.message : String(err);
  return `Could not ${action}: ${detail}${suffix}`;
}

export function userScopedStorageKey(namespace: string, userId: string): string {
  return `mtg_lister_${namespace}_${userId}`;
}

export function readUserScopedJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeUserScopedJson<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}
