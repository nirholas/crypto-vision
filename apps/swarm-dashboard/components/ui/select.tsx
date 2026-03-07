'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string }>;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary ring-offset-bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
);
Select.displayName = 'Select';

export { Select };
