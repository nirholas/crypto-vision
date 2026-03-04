/**
 * @fileoverview Premium Progress Components
 * 
 * Progress bars, circular progress, and loading indicators.
 * 
 * @module components/ui/Progress
 */
'use client';

export interface ProgressProps {
  value: number;
  max?: number;
  variant?: 'default' | 'gradient' | 'success' | 'danger' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
  className?: string;
}

const variantClasses = {
  default: 'bg-primary',
  gradient: 'bg-gradient-to-r from-primary to-purple-500',
  success: 'bg-gain',
  danger: 'bg-loss',
  warning: 'bg-warning',
};

const sizeClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export default function Progress({
  value,
  max = 100,
  variant = 'default',
  size = 'md',
  showLabel = false,
  label,
  animated = false,
  className = '',
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={`w-full ${className}`}>
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm text-text-secondary">{label}</span>
          {showLabel && (
            <span className="text-sm font-medium text-text-primary number-mono">
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <div className={`progress-bar ${sizeClasses[size]}`}>
        <div
          className={`
            progress-bar-fill
            ${variantClasses[variant]}
            ${animated ? 'progress-bar-animated' : ''}
          `}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
}

// Progress Bar (alias for backward compatibility)
export interface ProgressBarProps extends ProgressProps {}
export const ProgressBar = Progress;

// Circular Progress
export interface CircularProgressProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  strokeWidth?: number;
  variant?: 'default' | 'gradient' | 'success' | 'danger';
  showValue?: boolean;
  label?: string;
  className?: string;
}

const circularSizes = {
  sm: 40,
  md: 64,
  lg: 96,
  xl: 128,
};

const circularStrokeWidths = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
};

const circularVariantColors = {
  default: '#3861FB',
  gradient: 'url(#progress-gradient)',
  success: '#16C784',
  danger: '#EA3943',
};

export function CircularProgress({
  value,
  max = 100,
  size = 'md',
  strokeWidth,
  variant = 'default',
  showValue = true,
  label,
  className = '',
}: CircularProgressProps) {
  const diameter = circularSizes[size];
  const stroke = strokeWidth || circularStrokeWidths[size];
  const radius = (diameter - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        width={diameter}
        height={diameter}
        className="transform -rotate-90"
      >
        <defs>
          <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3861FB" />
            <stop offset="100%" stopColor="#818CF8" />
          </linearGradient>
        </defs>
        {/* Background circle */}
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-border)"
          strokeWidth={stroke}
        />
        {/* Progress circle */}
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke={circularVariantColors[variant]}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {(showValue || label) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {showValue && (
            <span 
              className="font-bold text-text-primary number-mono"
              style={{ fontSize: diameter * 0.2 }}
            >
              {percentage.toFixed(0)}%
            </span>
          )}
          {label && (
            <span 
              className="text-text-muted"
              style={{ fontSize: diameter * 0.12 }}
            >
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
