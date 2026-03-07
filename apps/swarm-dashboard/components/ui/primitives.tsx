import * as React from 'react';
import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-bg-hover', className)} {...props} />;
}

function Separator({ className, orientation = 'horizontal', ...props }: React.HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <div
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className,
      )}
      {...props}
    />
  );
}

function Switch({ checked, onCheckedChange, className, disabled }: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-accent-green' : 'bg-bg-hover',
        className,
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}

function Slider({ value, onValueChange, min = 0, max = 100, step = 1, className }: {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onValueChange(Number(e.target.value))}
      className={cn(
        'w-full h-2 rounded-lg appearance-none cursor-pointer bg-bg-hover accent-accent-blue',
        className,
      )}
    />
  );
}

export { Skeleton, Separator, Switch, Slider };
