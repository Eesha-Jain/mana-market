'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ToastVariant = 'error' | 'success' | 'info';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
}

interface ToastContextType {
  toast: (variant: ToastVariant, message: string, durationMs?: number) => string;
  error: (message: string, durationMs?: number) => string;
  success: (message: string, durationMs?: number) => string;
  info: (message: string, durationMs?: number) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const DEFAULT_DURATION_MS = 6000;

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (!toasts.length) return null;

  return (
    <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
      {toasts.map(item => (
        <div
          key={item.id}
          className={`toast toast--${item.variant}`}
          role={item.variant === 'error' ? 'alert' : 'status'}
        >
          <span className="toast-message">{item.message}</span>
          <button
            type="button"
            className="toast-dismiss"
            onClick={() => onDismiss(item.id)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback(
    (variant: ToastVariant, message: string, durationMs = DEFAULT_DURATION_MS) => {
      const trimmed = message.trim();
      if (!trimmed) return '';

      const id = crypto.randomUUID();
      setToasts(prev => [...prev, { id, variant, message: trimmed }]);

      if (durationMs > 0) {
        window.setTimeout(() => dismiss(id), durationMs);
      }

      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      toast,
      error: (message: string, durationMs?: number) => toast('error', message, durationMs),
      success: (message: string, durationMs?: number) => toast('success', message, durationMs),
      info: (message: string, durationMs?: number) => toast('info', message, durationMs),
      dismiss,
    }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside <ToastProvider>');
  return ctx;
}

/** Route review / lookup messages to error vs informational toasts. */
export function toastReviewMessage(
  toastApi: Pick<ToastContextType, 'error' | 'info'>,
  message: string,
) {
  const trimmed = message.trim();
  if (!trimmed) return;

  const isSoftNotice =
    /no online match|you can still edit|not found for this/i.test(trimmed);

  if (isSoftNotice) {
    toastApi.info(trimmed);
  } else {
    toastApi.error(trimmed);
  }
}
