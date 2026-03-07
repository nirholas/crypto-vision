import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-accent-blue text-white hover:bg-accent-blue/80',
        destructive: 'bg-accent-red text-white hover:bg-accent-red/80',
        outline: 'border border-border bg-transparent hover:bg-bg-hover text-text-primary',
        secondary: 'bg-bg-hover text-text-primary hover:bg-bg-card',
        ghost: 'hover:bg-bg-hover text-text-primary',
        success: 'bg-accent-green text-black hover:bg-accent-green/80',
        link: 'text-accent-blue underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-lg px-8 text-base',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  ),
);
Button.displayName = 'Button';

export { Button, buttonVariants };
