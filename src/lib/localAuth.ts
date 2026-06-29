import type { AppUser } from './supabaseDb';

const USERS_KEY = 'mtg_lister_users';
const SESSION_KEY = 'mtg_lister_session';

type StoredUser = AppUser & { password: string };

function loadUsers(): Record<string, StoredUser> {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) ?? '{}'); }
  catch { return {}; }
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
  if (stored.password !== password) return { success: false, error: 'Incorrect password.' };

  const { password: _pw, ...user } = stored;
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
    password,
  };
  users[email.toLowerCase()] = newUser;
  saveUsers(users);

  const { password: _pw, ...user } = newUser;
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
  return !import.meta.env.VITE_SUPABASE_URL?.trim() || !import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
}
