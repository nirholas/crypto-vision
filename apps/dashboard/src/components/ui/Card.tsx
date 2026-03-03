/**
 * @fileoverview Premium Card Components
 * 
 * Beautifully designed card variants with glassmorphism,
 * gradient accents, and smooth hover interactions.
 * 
 * @module components/ui/Card
 */
'use client';

import { forwardRef, HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass' | 'gradient' | 'interactive' | 'outline';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  glow?: 'none' | 'primary' | 'gain' | 'loss';
  /** Adds lift effect on hover (translateY + shadow) */
  lift?: boolean;
  /** Adds glowing border effect on hover */
  glowHover?: 'none' | 'primary' | 'gain' | 'loss';
  /** Adds shine sweep effect on hover */
  shine?: boolean;
}

const variantClasses = {
  default: `
    bg-surface border border-surface-border rounded-xl
    shadow-card
  `,
  elevated: `
    card-elevated
  `,
  glass: `
    glass-card rounded-xl
  `,
  gradient: `
    card-gradient
  `,
  interactive: `
    bg-surface border border-surface-border rounded-xl
    shadow-card card-interactive
  `,
  outline: `
    bg-transparent border border-surface-border rounded-xl
    hover:border-primary/50
  `,
};

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-6 sm:p-8',
};

const hoverClasses = `
  transition-all duration-300 ease-out
  hover:border-white/10
  hover:shadow-card-hover
  hover:-translate-y-1
`;

const glowClasses = {
  none: '',
  primary: 'glow-primary',
  gain: 'glow-gain',
  loss: 'glow-loss',
};

const glowHoverClasses = {
  none: '',
  primary: 'card-glow',
  gain: 'card-glow-gain',
  loss: 'card-glow-loss',
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      hover = false,
      glow = 'none',
      lift = false,
      glowHover = 'none',
      shine = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`
          ${variantClasses[variant]}
          ${paddingClasses[padding]}
          ${hover ? hoverClasses : ''}
          ${glowClasses[glow]}
          ${lift ? 'card-lift' : ''}
          ${glowHoverClasses[glowHover]}
          ${shine ? 'card-shine' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;

// Card Header
export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  className = '',
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={`flex items-start justify-between gap-4 ${className}`}
      {...props}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-text-primary truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-text-muted truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// Card Content
export function CardContent({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`mt-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

// Card Footer
export function CardFooter({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`mt-4 pt-4 border-t border-surface-border flex items-center justify-between gap-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

// Stat Card - for displaying metrics
export interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function StatCard({
  label,
  value,
  change,
  icon,
  trend,
  className = '',
}: StatCardProps) {
  const getTrendColor = () => {
    if (trend === 'up' || (change && change > 0)) return 'text-gain';
    if (trend === 'down' || (change && change < 0)) return 'text-loss';
    return 'text-text-muted';
  };

  const getTrendIcon = () => {
    if (trend === 'up' || (change && change > 0)) {
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      );
    }
    if (trend === 'down' || (change && change < 0)) {
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      );
    }
    return null;
  };

  return (
    <Card variant="default" padding="md" hover className={className}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-text-muted font-medium">{label}</p>
          <p className="mt-1 text-2xl font-bold text-text-primary number-mono">
            {value}
          </p>
          {change !== undefined && (
            <div className={`mt-2 flex items-center gap-1 ${getTrendColor()}`}>
              {getTrendIcon()}
              <span className="text-sm font-medium">
                {change > 0 ? '+' : ''}{change.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className="w-12 h-12 rounded-xl bg-surface-hover flex items-center justify-center text-text-muted">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

// Feature Card - for showcasing features
export interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  href?: string;
  className?: string;
}

export function FeatureCard({
  icon,
  title,
  description,
  href,
  className = '',
}: FeatureCardProps) {
  const content = (
    <>
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-sm text-text-muted leading-relaxed">{description}</p>
    </>
  );

  const cardClasses = `
    group card-gradient p-6
    hover:shadow-card-hover hover:-translate-y-1
    transition-all duration-300
    ${className}
  `;

  if (href) {
    return (
      <a href={href} className={cardClasses}>
        {content}
      </a>
    );
  }

  return <div className={cardClasses}>{content}</div>;
}
