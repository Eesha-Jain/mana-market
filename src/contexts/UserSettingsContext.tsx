'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
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
import { isSupabaseConfigured, getAccessToken } from '@/lib/supabase/client';
import { fetchUserSettingsAction, saveUserSettingsAction } from '@/app/actions/settings';

interface UserSettingsContextType {
  settings: UserSettings;
  syncError: string | null;
  loadError: string | null;
  clearSyncError: () => void;
  clearLoadError: () => void;
  updateSettings: (patch: Partial<UserSettings>) => void;
  isDefaultConfigured: (key: UserSettingKey) => boolean;
  saveConfiguredDefault: (patch: Partial<UserSettings>, keys: UserSettingKey | UserSettingKey[]) => void;
  clearConfiguredDefault: (key: UserSettingKey, patch?: Partial<UserSettings>) => void;
  applyDefaultTitleCase: (text: string) => string;
  applyDefaultDescriptionCase: (text: string) => string;
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

function formatSyncError(err: unknown, action: string): string {
  const detail = err instanceof Error ? err.message : String(err);
  return `Could not ${action}: ${detail}.`;
}

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hydratedRef = useRef(false);
  const dirtyRef = useRef(false);

  const clearSyncError = useCallback(() => setSyncError(null), []);
  const clearLoadError = useCallback(() => setLoadError(null), []);

  useEffect(() => {
    if (!user) {
      hydratedRef.current = false;
      dirtyRef.current = false;
      setSettings(DEFAULT_USER_SETTINGS);
      setLoadError(null);
      return;
    }

    dirtyRef.current = false;
    hydratedRef.current = false;
    setLoadError(null);

    if (isSupabaseConfigured()) {
      void getAccessToken()
        .then(async token => {
          if (!token) throw new Error('Not signed in');
          return fetchUserSettingsAction(token);
        })
        .then(loaded => {
          if (dirtyRef.current) return;
          setSettings(loaded ?? DEFAULT_USER_SETTINGS);
          hydratedRef.current = true;
        })
        .catch(err => {
          if (dirtyRef.current) return;
          setLoadError(formatSyncError(err, 'load your settings'));
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
      void getAccessToken().then(token => {
        if (!token) return;
        void saveUserSettingsAction(token, settings).catch(err => {
          setSyncError(formatSyncError(err, 'save settings'));
        });
      });
      return;
    }

    writeLocalSettings(user.id, settings);
  }, [settings, user?.id]);

  const updateSettings = (patch: Partial<UserSettings>) => {
    dirtyRef.current = true;
    setSettings(prev => ({ ...prev, ...patch }));
  };

  const saveConfiguredDefault = (patch: Partial<UserSettings>, keys: UserSettingKey | UserSettingKey[]) => {
    dirtyRef.current = true;
    setSettings(prev => ({
      ...prev,
      ...patch,
      configuredDefaults: markKeysConfigured(prev.configuredDefaults, keys),
    }));
  };

  const clearConfiguredDefault = (key: UserSettingKey, patch: Partial<UserSettings> = {}) => {
    dirtyRef.current = true;
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
        syncError,
        loadError,
        clearSyncError,
        clearLoadError,
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
