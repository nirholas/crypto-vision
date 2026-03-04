/**
 * @fileoverview Premium Button Components
 * 
 * A collection of beautifully designed button variants with
 * glassmorphism, gradients, and micro-interactions.
 * 
 * @module components/ui/Button
 */
'use client';

import { forwardRef, ButtonHTMLAttributes, ReactNode, useState, useCallback } from 'react';

interface RippleItem {
  x: number;
  y: number;
  id: number;
  size: number;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success' | 'glass';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  glow?: boolean;
  shine?: boolean;
  /** Adds pulse animation for CTAs */
  pulse?: boolean;
  /** Adds material-style ripple effect on click */
  ripple?: boolean;
}

const variantClasses = {
  primary: `
    bg-primary hover:bg-primary-hover text-white
    shadow-lg shadow-primary/20 hover:shadow-primary/30
    active:scale-[0.98]
  `,
  secondary: `
    bg-surface hover:bg-surface-hover text-text-primary
    border border-surface-border hover:border-surface-hover
    active:scale-[0.98]
  `,
  ghost: `
    bg-transparent hover:bg-surface-hover text-text-secondary hover:text-text-primary
    active:scale-[0.98]
  `,
  outline: `
    bg-transparent border border-primary text-primary
    hover:bg-primary/10
    active:scale-[0.98]
  `,
  danger: `
    bg-loss hover:brightness-110 text-white
    shadow-lg shadow-loss/20 hover:shadow-loss/30
    active:scale-[0.98]
  `,
  success: `
    bg-gain hover:brightness-110 text-white
    shadow-lg shadow-gain/20 hover:shadow-gain/30
    active:scale-[0.98]
  `,
  glass: `
    bg-white/5 hover:bg-white/10 text-text-primary
    backdrop-blur-md border border-white/10 hover:border-white/20
    active:scale-[0.98]
  `,
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm gap-1.5 rounded-lg',
  md: 'px-4 py-2 text-sm gap-2 rounded-xl',
  lg: 'px-6 py-3 text-base gap-2 rounded-xl',
  xl: 'px-8 py-4 text-lg gap-3 rounded-2xl',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      glow = false,
      shine = false,
      pulse = false,
      ripple = false,
      className = '',
      disabled,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const [ripples, setRipples] = useState<RippleItem[]>([]);

    const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      if (ripple && !disabled && !isLoading) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const size = Math.max(rect.width, rect.height) * 2;
        const id = Date.now();

        setRipples(prev => [...prev, { x, y, id, size }]);

        setTimeout(() => {
          setRipples(prev => prev.filter(r => r.id !== id));
        }, 600);
      }

      onClick?.(e);
    }, [ripple, disabled, isLoading, onClick]);

    const baseClasses = `
      inline-flex items-center justify-center font-medium
      transition-all duration-200 ease-out
      focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background
      disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
    `;

    const glowClasses = glow ? 'btn-glow' : '';
    const shineClasses = shine ? 'btn-shine' : '';
    const pulseClasses = pulse && !disabled ? 'btn-pulse' : '';
    const rippleClasses = ripple ? 'relative overflow-hidden' : '';

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        onClick={handleClick}
        className={`
          ${baseClasses}
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${glowClasses}
          ${shineClasses}
          ${pulseClasses}
          ${rippleClasses}
          ${className}
        `}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
        
        {/* Ripple effects */}
        {ripple && ripples.map(r => (
          <span
            key={r.id}
            className="absolute pointer-events-none rounded-full ripple-circle"
            style={{
              left: r.x,
              top: r.y,
              width: r.size,
              height: r.size,
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(255, 255, 255, 0.35)',
            }}
          />
        ))}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;

// Icon Button variant
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  icon: ReactNode;
  'aria-label': string;
}

const iconSizeClasses = {
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-10 h-10 rounded-xl',
  lg: 'w-12 h-12 rounded-xl',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      variant = 'ghost',
      size = 'md',
      icon,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseClasses = `
      inline-flex items-center justify-center
      transition-all duration-200 ease-out
      focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background
      disabled:opacity-50 disabled:cursor-not-allowed
    `;

    return (
      <button
        ref={ref}
        className={`
          ${baseClasses}
          ${variantClasses[variant]}
          ${iconSizeClasses[size]}
          ${className}
        `}
        {...props}
      >
        {icon}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
