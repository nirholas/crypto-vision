'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

// Convenience hooks
export function useToastActions() {
  const { addToast } = useToast();

  return {
    success: (title: string, message?: string) => addToast({ type: 'success', title, message }),
    error: (title: string, message?: string) =>
      addToast({ type: 'error', title, message, duration: 8000 }),
    warning: (title: string, message?: string) => addToast({ type: 'warning', title, message }),
    info: (title: string, message?: string) => addToast({ type: 'info', title, message }),
  };
}

interface ToastProviderProps {
  children: ReactNode;
  /** Max toasts to show at once */
  maxToasts?: number;
  /** Default duration in ms */
  defaultDuration?: number;
  /** Position of toast container */
  position?:
    | 'top-right'
    | 'top-left'
    | 'bottom-right'
    | 'bottom-left'
    | 'top-center'
    | 'bottom-center';
}

export function ToastProvider({
  children,
  maxToasts = 3,
  defaultDuration = 5000,
  position = 'bottom-right',
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: Toast = {
        ...toast,
        id,
        duration: toast.duration ?? defaultDuration,
      };

      setToasts((prev) => {
        const updated = [...prev, newToast];
        // Remove oldest if exceeding max
        if (updated.length > maxToasts) {
          return updated.slice(-maxToasts);
        }
        return updated;
      });

      return id;
    },
    [defaultDuration, maxToasts]
  );

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  // Position classes
  const positionClasses: Record<string, string> = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearAll }}>
      {children}

      {/* Toast Container */}
      <div
        className={`fixed z-50 flex flex-col gap-2 pointer-events-none ${positionClasses[position]}`}
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Colored type styles using CSS variables
const typeConfig: Record<ToastType, { color: string; bgColor: string; icon: React.ReactNode }> = {
  success: {
    color: 'var(--gain)',
    bgColor: 'var(--gain-bg)',
    icon: <CheckCircle2 className="w-5 h-5" />,
  },
  error: {
    color: 'var(--loss)',
    bgColor: 'var(--loss-bg)',
    icon: <XCircle className="w-5 h-5" />,
  },
  warning: {
    color: 'var(--warning)',
    bgColor: 'var(--warning-bg)',
    icon: <AlertTriangle className="w-5 h-5" />,
  },
  info: {
    color: 'var(--info)',
    bgColor: 'rgba(123, 97, 255, 0.1)',
    icon: <Info className="w-5 h-5" />,
  },
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const config = typeConfig[toast.type];

  // Auto-dismiss timer
  useEffect(() => {
    if (!toast.duration) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / toast.duration!) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        handleDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 200);
  };

  return (
    <div
      className={`
        pointer-events-auto w-80 max-w-[calc(100vw-2rem)]
        rounded-xl shadow-lg overflow-hidden
        transform transition-all duration-200
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--surface-border)',
      }}
      role="alert"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Colored icon */}
          <div className="flex-shrink-0" style={{ color: config.color }}>
            {config.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {toast.title}
            </p>
            {toast.message && (
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {toast.message}
              </p>
            )}
            {toast.action && (
              <button
                onClick={() => {
                  toast.action!.onClick();
                  handleDismiss();
                }}
                className="mt-2 text-sm font-medium transition-opacity hover:opacity-80"
                style={{ color: 'var(--primary)' }}
              >
                {toast.action.label}
              </button>
            )}
          </div>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Colored progress bar */}
      {toast.duration && (
        <div className="h-0.5" style={{ background: 'var(--surface-hover)' }}>
          <div
            className="h-full transition-all duration-100"
            style={{
              width: `${progress}%`,
              background: config.color,
            }}
          />
        </div>
      )}
    </div>
  );
}

export default ToastProvider;
