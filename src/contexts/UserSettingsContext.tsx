import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { applyTextCase } from '../utils/textCase';
import {
  DEFAULT_USER_SETTINGS,
  isDefaultConfigured,
  loadUserSettings,
  type PhotoCaptureTarget,
  type UserSettingKey,
  type UserSettings,
} from '../utils/userSettings';
import { useAuth } from './AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { fetchUserSettings, saveUserSettings } from '../lib/supabaseDb';

interface UserSettingsContextType {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void;
  isDefaultConfigured: (key: UserSettingKey) => boolean;
  saveConfiguredDefault: (patch: Partial<UserSettings>, keys: UserSettingKey | UserSettingKey[]) => void;
  clearConfiguredDefault: (key: UserSettingKey, patch?: Partial<UserSettings>) => void;
  applyDefaultTitleCase: (text: string) => string;
  applyDefaultDescriptionCase: (text: string) => string;
  /** Effective photo target — null when user has not set a default. */
  defaultPhotoCaptureTarget: PhotoCaptureTarget | null;
}

const UserSettingsContext = createContext<UserSettingsContextType | null>(null);

function localStorageKey(userId: string) {
  return `mtg_lister_settings_${userId}`;
}

function readLocalSettings(userId: string): UserSettings {
  try {
    const raw = localStorage.getItem(localStorageKey(userId));
    if (!raw) return DEFAULT_USER_SETTINGS;
    return loadUserSettings(JSON.parse(raw) as Partial<UserSettings>);
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

function writeLocalSettings(userId: string, settings: UserSettings) {
  localStorage.setItem(localStorageKey(userId), JSON.stringify(settings));
}

function markKeysConfigured(
  configured: UserSettings['configuredDefaults'],
  keys: UserSettingKey | UserSettingKey[],
): UserSettings['configuredDefaults'] {
  const next = { ...configured };
  const list = Array.isArray(keys) ? keys : [keys];
  for (const key of list) {
    next[key] = true;
  }
  return next;
}

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      hydratedRef.current = false;
      setSettings(DEFAULT_USER_SETTINGS);
      return;
    }

    if (isSupabaseConfigured()) {
      hydratedRef.current = false;
      fetchUserSettings(user.id)
        .then(loaded => {
          setSettings(loaded ?? DEFAULT_USER_SETTINGS);
          hydratedRef.current = true;
        })
        .catch(() => {
          setSettings(DEFAULT_USER_SETTINGS);
          hydratedRef.current = true;
        });
      return;
    }

    hydratedRef.current = true;
    setSettings(readLocalSettings(user.id));
  }, [user?.id]);

  useEffect(() => {
    if (!user || !hydratedRef.current) return;

    if (isSupabaseConfigured()) {
      void saveUserSettings(user.id, settings);
      return;
    }

    writeLocalSettings(user.id, settings);
  }, [settings, user?.id]);

  const updateSettings = (patch: Partial<UserSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
  };

  const saveConfiguredDefault = (patch: Partial<UserSettings>, keys: UserSettingKey | UserSettingKey[]) => {
    setSettings(prev => ({
      ...prev,
      ...patch,
      configuredDefaults: markKeysConfigured(prev.configuredDefaults, keys),
    }));
  };

  const clearConfiguredDefault = (key: UserSettingKey, patch: Partial<UserSettings> = {}) => {
    setSettings(prev => {
      const configuredDefaults = { ...prev.configuredDefaults };
      delete configuredDefaults[key];
      return { ...prev, ...patch, configuredDefaults };
    });
  };

  const checkConfigured = (key: UserSettingKey) => isDefaultConfigured(settings, key);

  const applyDefaultTitleCase = (text: string) => applyTextCase(text, settings.defaultTitleCase);

  const applyDefaultDescriptionCase = (text: string) =>
    applyTextCase(text, settings.defaultDescriptionCase);

  const defaultPhotoCaptureTarget = checkConfigured('photoCaptureTarget')
    ? settings.defaultPhotoCaptureTarget
    : null;

  return (
    <UserSettingsContext.Provider
      value={{
        settings,
        updateSettings,
        isDefaultConfigured: checkConfigured,
        saveConfiguredDefault,
        clearConfiguredDefault,
        applyDefaultTitleCase,
        applyDefaultDescriptionCase,
        defaultPhotoCaptureTarget,
      }}
    >
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings() {
  const ctx = useContext(UserSettingsContext);
  if (!ctx) throw new Error('useUserSettings must be inside <UserSettingsProvider>');
  return ctx;
}
