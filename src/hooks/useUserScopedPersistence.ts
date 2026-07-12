'use client';

import { useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, getAccessToken } from '@/lib/supabase/client';
import {
  formatPersistenceError,
  readUserScopedJson,
  userScopedStorageKey,
  writeUserScopedJson,
} from '@/lib/persistence/userScopedStorage';

interface UserScopedPersistenceOptions<T> {
  namespace: string;
  userId: string | undefined;
  defaultValue: T;
  loadRemote?: (token: string) => Promise<T | null>;
  saveRemote?: (token: string, data: T) => Promise<void>;
  readLocal?: (userId: string) => T;
  writeLocal?: (userId: string, data: T) => void;
  onLoadError: (message: string) => void;
  onSaveError: (message: string) => void;
}

export function useUserScopedPersistence<T>({
  namespace,
  userId,
  defaultValue,
  loadRemote,
  saveRemote,
  readLocal,
  writeLocal,
  onLoadError,
  onSaveError,
}: UserScopedPersistenceOptions<T>) {
  const [data, setData] = useState<T>(defaultValue);
  const hydratedRef = useRef(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      hydratedRef.current = false;
      dirtyRef.current = false;
      setData(defaultValue);
      return;
    }

    dirtyRef.current = false;
    hydratedRef.current = false;

    if (isSupabaseConfigured() && loadRemote) {
      void getAccessToken()
        .then(async token => {
          if (!token) throw new Error('Not signed in');
          return loadRemote(token);
        })
        .then(loaded => {
          if (dirtyRef.current) return;
          setData(loaded ?? defaultValue);
          hydratedRef.current = true;
        })
        .catch(err => {
          if (dirtyRef.current) return;
          onLoadError(formatPersistenceError(err, `load your ${namespace}`));
          setData(defaultValue);
          hydratedRef.current = true;
        });
      return;
    }

    hydratedRef.current = true;
    const localReader = readLocal ?? ((id: string) =>
      readUserScopedJson(userScopedStorageKey(namespace, id), defaultValue));
    setData(localReader(userId));
  }, [userId, defaultValue, loadRemote, namespace, onLoadError, readLocal]);

  useEffect(() => {
    if (!userId || !hydratedRef.current) return;

    if (isSupabaseConfigured() && saveRemote) {
      void getAccessToken().then(token => {
        if (!token) return;
        void saveRemote(token, data).catch(err => {
          onSaveError(formatPersistenceError(err, `save ${namespace}`));
        });
      });
      return;
    }

    const localWriter = writeLocal ?? ((id: string, value: T) =>
      writeUserScopedJson(userScopedStorageKey(namespace, id), value));
    localWriter(userId, data);
  }, [data, userId, namespace, onSaveError, saveRemote, writeLocal]);

  const update = (patch: Partial<T> | ((prev: T) => T)) => {
    dirtyRef.current = true;
    setData(prev => {
      if (typeof patch === 'function') return patch(prev);
      return { ...prev, ...patch };
    });
  };

  return { data, setData, update, hydratedRef, dirtyRef };
}
