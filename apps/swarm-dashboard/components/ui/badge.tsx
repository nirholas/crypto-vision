import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-accent-blue/20 text-accent-blue',
        success: 'border-transparent bg-accent-green/20 text-accent-green',
        destructive: 'border-transparent bg-accent-red/20 text-accent-red',
        warning: 'border-transparent bg-accent-orange/20 text-accent-orange',
        purple: 'border-transparent bg-accent-purple/20 text-accent-purple',
        outline: 'border-border text-text-secondary',
        secondary: 'border-transparent bg-bg-hover text-text-secondary',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
