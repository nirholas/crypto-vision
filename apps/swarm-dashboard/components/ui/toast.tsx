'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'destructive' | 'warning';
  duration?: number;
}

let addToastFn: ((toast: Omit<Toast, 'id'>) => void) | null = null;

export function toast(params: Omit<Toast, 'id'>) {
  addToastFn?.(params);
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  addToastFn = useCallback((params: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...params, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, params.duration ?? 5000);
  }, []);

  const icons = {
    default: <Info className="h-4 w-4 text-accent-blue" />,
    success: <CheckCircle className="h-4 w-4 text-accent-green" />,
    destructive: <AlertCircle className="h-4 w-4 text-accent-red" />,
    warning: <AlertTriangle className="h-4 w-4 text-accent-orange" />,
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-start gap-3 rounded-lg border border-border bg-bg-card p-4 shadow-lg animate-in',
          )}
        >
          {icons[t.variant ?? 'default']}
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">{t.title}</p>
            {t.description && <p className="text-xs text-text-secondary mt-1">{t.description}</p>}
          </div>
          <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}>
            <X className="h-3 w-3 text-text-muted" />
          </button>
        </div>
      ))}
    </div>
  );
}
