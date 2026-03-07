'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative z-50 max-h-[90vh] overflow-auto">{children}</div>
    </div>
  );
}

function DialogContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'w-full max-w-lg rounded-xl border border-border bg-bg-card p-6 shadow-2xl animate-in',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold leading-none tracking-tight text-text-primary', className)} {...props} />;
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-text-secondary', className)} {...props} />;
}

function DialogClose({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 text-text-secondary"
    >
      <X className="h-4 w-4" />
    </button>
  );
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose };
