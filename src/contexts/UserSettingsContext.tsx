'use client';

import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { applyTextCase } from '../utils/settings';
import {
  DEFAULT_USER_SETTINGS,
  isSettingConfigured,
  loadUserSettings,
  resolveDescriptionCase,
  resolveTitleCase,
  type PhotoCaptureTarget,
  type UserSettingKey,
  type UserSettings,
} from '../utils/settings';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { fetchUserSettingsAction, saveUserSettingsAction } from '@/lib/settings/actions';
import { getAccessToken } from '@/lib/supabase/client';

interface UserSettingsContextType {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void;
  isSettingConfigured: (key: UserSettingKey) => boolean;
  applyDefaultTitleCase: (text: string) => string;
  applyDefaultDescriptionCase: (text: string) => string;
  photoCaptureTarget: PhotoCaptureTarget | null;
}

const UserSettingsContext = createContext<UserSettingsContextType | null>(null);

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);

  useEffect(() => {
    if (!user) {
      setSettings(DEFAULT_USER_SETTINGS);
      return;
    }

    let active = true;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token || !active) return;
        const remote = await fetchUserSettingsAction(token);
        if (active) setSettings(loadUserSettings(remote));
      } catch {
        if (active) toast.error('Failed to load settings.');
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.id, toast]);

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setSettings(prev => {
      const next = loadUserSettings({ ...prev, ...patch });
      void (async () => {
        try {
          const token = await getAccessToken();
          if (!token) return;
          await saveUserSettingsAction(token, next);
        } catch {
          toast.error('Failed to save settings.');
        }
      })();
      return next;
    });
  }, [toast]);

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
