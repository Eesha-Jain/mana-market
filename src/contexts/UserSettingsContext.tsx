'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { applyTextCase } from '../utils/textCase';
import {
  DEFAULT_USER_SETTINGS,
  isSettingConfigured,
  loadUserSettings,
  resolveDescriptionCase,
  resolveTitleCase,
  type PhotoCaptureTarget,
  type UserSettingKey,
  type UserSettings,
} from '../utils/userSettings';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { isSupabaseConfigured, getAccessToken } from '@/lib/supabase/client';
import { fetchUserSettingsAction, saveUserSettingsAction } from '@/lib/settings/actions';

interface UserSettingsContextType {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void;
  isSettingConfigured: (key: UserSettingKey) => boolean;
  applyDefaultTitleCase: (text: string) => string;
  applyDefaultDescriptionCase: (text: string) => string;
  photoCaptureTarget: PhotoCaptureTarget | null;
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

function formatSyncError(err: unknown, action: string): string {
  const detail = err instanceof Error ? err.message : String(err);
  return `Could not ${action}: ${detail}.`;
}

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const hydratedRef = useRef(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!user) {
      hydratedRef.current = false;
      dirtyRef.current = false;
      setSettings(DEFAULT_USER_SETTINGS);
      return;
    }

    dirtyRef.current = false;
    hydratedRef.current = false;

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
          toast.error(formatSyncError(err, 'load your settings'));
          setSettings(DEFAULT_USER_SETTINGS);
          hydratedRef.current = true;
        });
      return;
    }

    hydratedRef.current = true;
    setSettings(readLocalSettings(user.id));
  }, [user?.id, toast]);

  useEffect(() => {
    if (!user || !hydratedRef.current) return;

    if (isSupabaseConfigured()) {
      void getAccessToken().then(token => {
        if (!token) return;
        void saveUserSettingsAction(token, settings).catch(err => {
          toast.error(formatSyncError(err, 'save settings'));
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

  const checkConfigured = (key: UserSettingKey) => isSettingConfigured(settings, key);

  const applyDefaultTitleCase = (text: string) => applyTextCase(text, resolveTitleCase(settings));

  const applyDefaultDescriptionCase = (text: string) =>
    applyTextCase(text, resolveDescriptionCase(settings));

  return (
    <UserSettingsContext.Provider
      value={{
        settings,
        updateSettings,
        isSettingConfigured: checkConfigured,
        applyDefaultTitleCase,
        applyDefaultDescriptionCase,
        photoCaptureTarget: settings.photoCaptureTarget,
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
