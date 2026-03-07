'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: 'left' | 'right';
}

function Sheet({ open, onOpenChange, children, side = 'right' }: SheetProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div
        className={cn(
          'fixed top-0 bottom-0 z-50 w-full max-w-md bg-bg-card border-border shadow-2xl transition-transform overflow-y-auto',
          side === 'right' ? 'right-0 border-l animate-in' : 'left-0 border-r animate-in',
        )}
      >
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 text-text-secondary z-10"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-2 p-6 pb-2', className)} {...props} />;
}

function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-lg font-semibold text-text-primary', className)} {...props} />;
}

function SheetContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-2', className)} {...props} />;
}

export { Sheet, SheetHeader, SheetTitle, SheetContent };
