import type { AppUser } from './db/profiles';
import { publicEnv } from './env/public';

const USERS_KEY = 'mtg_lister_users';
const SESSION_KEY = 'mtg_lister_session';

type StoredUser = AppUser & { passwordHash: string };

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function loadUsers(): Record<string, StoredUser> {
  try {
    const raw = JSON.parse(localStorage.getItem(USERS_KEY) ?? '{}') as Record<string, unknown>;
    const out: Record<string, StoredUser> = {};
    for (const [email, value] of Object.entries(raw)) {
      if (!value || typeof value !== 'object') continue;
      const row = value as Record<string, unknown>;
      if (typeof row.id !== 'string' || typeof row.email !== 'string' || typeof row.name !== 'string') {
        continue;
      }
      const hash =
        typeof row.passwordHash === 'string'
          ? row.passwordHash
          : typeof row.password === 'string'
            ? row.password
            : '';
      if (!hash) continue;
      out[email] = {
        id: row.id,
        email: row.email,
        name: row.name,
        passwordHash: hash,
      };
    }
    return out;
  } catch {
    return {};
  }
}

function saveUsers(users: Record<string, StoredUser>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export async function localLogin(
  email: string,
  password: string,
): Promise<{ success: boolean; user?: AppUser; error?: string }> {
  const users = loadUsers();
  const stored = users[email.toLowerCase()];
  if (!stored) return { success: false, error: 'No account found with this email.' };

  const passwordHash = await hashPassword(password);
  const legacyPlaintext = stored.passwordHash.length < 64 && stored.passwordHash === password;
  if (stored.passwordHash !== passwordHash && !legacyPlaintext) {
    return { success: false, error: 'Incorrect password.' };
  }

  if (legacyPlaintext) {
    users[email.toLowerCase()] = { ...stored, passwordHash };
    saveUsers(users);
  }

  const { passwordHash: _hash, ...user } = stored;
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return { success: true, user };
}

export async function localRegister(
  name: string,
  email: string,
  password: string,
): Promise<{ success: boolean; user?: AppUser; error?: string }> {
  const users = loadUsers();
  if (users[email.toLowerCase()]) {
    return { success: false, error: 'An account with this email already exists.' };
  }

  const newUser: StoredUser = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    name: name.trim(),
    passwordHash: await hashPassword(password),
  };
  users[email.toLowerCase()] = newUser;
  saveUsers(users);

  const { passwordHash: _hash, ...user } = newUser;
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return { success: true, user };
}

export function localLogout() {
  localStorage.removeItem(SESSION_KEY);
}

export function loadLocalSession(): AppUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppUser;
  } catch {
    return null;
  }
}

export function isLocalAuthMode(): boolean {
  return !publicEnv('SUPABASE_URL') || !publicEnv('SUPABASE_ANON_KEY');
}
