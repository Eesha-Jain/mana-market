'use client';

import { createContext, useContext, useCallback, type ReactNode } from 'react';
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
import { fetchUserSettingsAction, saveUserSettingsAction } from '@/lib/settings/actions';
import {
  readUserScopedJson,
  userScopedStorageKey,
  writeUserScopedJson,
} from '@/lib/persistence/userScopedStorage';
import { useUserScopedPersistence } from '@/hooks/useUserScopedPersistence';

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

  const onLoadError = useCallback((message: string) => {
    toast.error(message);
  }, [toast]);

  const onSaveError = useCallback((message: string) => {
    toast.error(message);
  }, [toast]);

  const readLocalSettings = useCallback((userId: string) => {
    const key = userScopedStorageKey('settings', userId);
    const raw = readUserScopedJson<Partial<UserSettings>>(key, {});
    return loadUserSettings(raw);
  }, []);

  const writeLocalSettings = useCallback((userId: string, settings: UserSettings) => {
    writeUserScopedJson(userScopedStorageKey('settings', userId), settings);
  }, []);

  const { data: settings, update: updateSettings } = useUserScopedPersistence({
    namespace: 'settings',
    userId: user?.id,
    defaultValue: DEFAULT_USER_SETTINGS,
    loadRemote: fetchUserSettingsAction,
    saveRemote: saveUserSettingsAction,
    readLocal: readLocalSettings,
    writeLocal: writeLocalSettings,
    onLoadError,
    onSaveError,
  });

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
