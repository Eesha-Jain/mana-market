'use client';

import { useItems } from '@/contexts/ItemsContext';
import { useUserSettings } from '@/contexts/UserSettingsContext';

export function SyncErrorBanner() {
  const { syncError, loadError, clearSyncError, clearLoadError } = useItems();
  const { syncError: settingsSyncError, loadError: settingsLoadError, clearSyncError: clearSettingsSync, clearLoadError: clearSettingsLoad } = useUserSettings();

  const message = syncError || loadError || settingsSyncError || settingsLoadError;
  if (!message) return null;

  const dismiss = () => {
    clearSyncError();
    clearLoadError();
    clearSettingsSync();
    clearSettingsLoad();
  };

  return (
    <div className="form-error-banner sync-error-banner" role="alert">
      <span>{message}</span>
      <button type="button" className="btn-link btn-sm" onClick={dismiss}>
        Dismiss
      </button>
    </div>
  );
}
