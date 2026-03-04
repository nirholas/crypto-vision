/**
 * MarketMoodRing Component
 *
 * A visually striking circular gauge that displays market sentiment
 * using animated concentric rings with dynamic colors based on
 * fear/greed index and market conditions.
 *
 * @features
 * - Animated SVG rings with gradient fills
 * - Real-time fear/greed index display
 * - Pulsing glow effects based on market intensity
 * - Interactive hover states with detailed tooltips
 * - Responsive design with multiple size variants
 * - Accessibility support with ARIA labels
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { tokens } from '@/lib/colors';

interface MarketMoodRingProps {
  /** Fear & Greed index value (0-100) */
  value?: number;
  /** Previous value for trend indication */
  previousValue?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Show detailed breakdown */
  showDetails?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Enable animations */
  animated?: boolean;
}

interface MoodLevel {
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  glowColor: string;
  description: string;
}

const moodLevels: Record<string, MoodLevel> = {
  extremeFear: {
    label: 'Extreme Fear',
    emoji: '😱',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    glowColor: 'rgba(239, 68, 68, 0.4)',
    description: 'Market is in panic mode. Historically a buying opportunity.',
  },
  fear: {
    label: 'Fear',
    emoji: '😰',
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.15)',
    glowColor: 'rgba(249, 115, 22, 0.4)',
    description: 'Investors are worried. Prices may be undervalued.',
  },
  neutral: {
    label: 'Neutral',
    emoji: '😐',
    color: '#eab308',
    bgColor: 'rgba(234, 179, 8, 0.15)',
    glowColor: 'rgba(234, 179, 8, 0.4)',
    description: 'Market sentiment is balanced. Wait for clearer signals.',
  },
  greed: {
    label: 'Greed',
    emoji: '🤑',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.15)',
    glowColor: 'rgba(34, 197, 94, 0.4)',
    description: 'Investors are getting greedy. Be cautious.',
  },
  extremeGreed: {
    label: 'Extreme Greed',
    emoji: '🚀',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.15)',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    description: 'Market is euphoric. Consider taking profits.',
  },
};

function getMoodLevel(value: number): MoodLevel {
  if (value <= 20) return moodLevels.extremeFear;
  if (value <= 40) return moodLevels.fear;
  if (value <= 60) return moodLevels.neutral;
  if (value <= 80) return moodLevels.greed;
  return moodLevels.extremeGreed;
}

const sizeConfig = {
  sm: { width: 120, strokeWidth: 8, fontSize: 'text-lg', labelSize: 'text-xs' },
  md: { width: 180, strokeWidth: 12, fontSize: 'text-2xl', labelSize: 'text-sm' },
  lg: { width: 240, strokeWidth: 16, fontSize: 'text-4xl', labelSize: 'text-base' },
  xl: { width: 320, strokeWidth: 20, fontSize: 'text-5xl', labelSize: 'text-lg' },
};

export default function MarketMoodRing({
  value = 50,
  previousValue,
  size = 'md',
  showDetails = true,
  className = '',
  animated = true,
}: MarketMoodRingProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const config = sizeConfig[size];
  const mood = useMemo(() => getMoodLevel(value), [value]);
  const trend = previousValue !== undefined ? value - previousValue : 0;

  // Animate value on mount and change
  useEffect(() => {
    if (!animated) {
      setDisplayValue(value);
      return;
    }

    const duration = 1500;
    const startTime = Date.now();
    const startValue = displayValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOutExpo = 1 - Math.pow(2, -10 * progress);
      const current = startValue + (value - startValue) * easeOutExpo;

      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, animated]);

  // Calculate ring properties
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = displayValue / 100;
  const strokeDashoffset = circumference * (1 - progress);

  // Generate gradient ID unique to this instance
  const gradientId = useMemo(() => `mood-gradient-${Math.random().toString(36).substr(2, 9)}`, []);
  const glowId = useMemo(() => `mood-glow-${Math.random().toString(36).substr(2, 9)}`, []);

  return (
    <div
      className={`relative inline-flex flex-col items-center ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow effect behind the ring */}
      <div
        className={`absolute inset-0 rounded-full blur-xl transition-opacity duration-500 ${
          animated ? 'animate-pulse' : ''
        }`}
        style={{
          background: mood.glowColor,
          opacity: isHovered ? 0.6 : 0.3,
          transform: 'scale(0.8)',
        }}
      />

      {/* SVG Ring */}
      <svg
        width={config.width}
        height={config.width}
        viewBox={`0 0 ${config.width} ${config.width}`}
        className="relative z-10 transform -rotate-90"
        role="img"
        aria-label={`Market mood: ${mood.label} at ${Math.round(displayValue)}%`}
      >
        <defs>
          {/* Gradient for the progress ring */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={moodLevels.extremeFear.color} />
            <stop offset="25%" stopColor={moodLevels.fear.color} />
            <stop offset="50%" stopColor={moodLevels.neutral.color} />
            <stop offset="75%" stopColor={moodLevels.greed.color} />
            <stop offset="100%" stopColor={moodLevels.extremeGreed.color} />
          </linearGradient>

          {/* Glow filter */}
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background ring */}
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={config.strokeWidth}
          className="text-surface-border opacity-30"
        />

        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const angle = (tick / 100) * 360 - 90;
          const tickRadius = radius + config.strokeWidth / 2 + 4;
          const x = config.width / 2 + tickRadius * Math.cos((angle * Math.PI) / 180);
          const y = config.width / 2 + tickRadius * Math.sin((angle * Math.PI) / 180);
          return <circle key={tick} cx={x} cy={y} r={2} className="fill-text-muted" />;
        })}

        {/* Progress ring */}
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          filter={`url(#${glowId})`}
          className="transition-all duration-300"
          style={{
            filter: isHovered ? `url(#${glowId})` : 'none',
          }}
        />

        {/* Current position indicator */}
        <circle
          cx={config.width / 2 + radius * Math.cos(((progress * 360 - 90) * Math.PI) / 180)}
          cy={config.width / 2 + radius * Math.sin(((progress * 360 - 90) * Math.PI) / 180)}
          r={config.strokeWidth / 2 + 2}
          fill={mood.color}
          className={`${animated ? 'animate-pulse' : ''}`}
        />
      </svg>

      {/* Center content */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center z-20"
        style={{ padding: config.strokeWidth * 2 }}
      >
        {/* Emoji */}
        <span className={`${config.fontSize} mb-1`} role="img" aria-hidden="true">
          {mood.emoji}
        </span>

        {/* Value */}
        <span className={`${config.fontSize} font-bold`} style={{ color: mood.color }}>
          {Math.round(displayValue)}
        </span>

        {/* Label */}
        <span className={`${config.labelSize} text-text-muted font-medium mt-1`}>{mood.label}</span>

        {/* Trend indicator */}
        {trend !== 0 && (
          <span
            className={`${config.labelSize} flex items-center gap-0.5 mt-1 font-medium ${
              trend > 0 ? 'text-gain' : 'text-loss'
            }`}
          >
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}
          </span>
        )}
      </div>

      {/* Details panel */}
      {showDetails && (
        <div
          className={`mt-4 p-4 rounded-xl bg-surface border border-surface-border text-center max-w-xs transition-all duration-300 ${
            isHovered ? 'opacity-100 translate-y-0' : 'opacity-70 translate-y-1'
          }`}
        >
          <p className="text-text-secondary text-sm leading-relaxed">{mood.description}</p>

          {/* Mini breakdown */}
          <div className="flex justify-center gap-2 mt-3">
            {Object.entries(moodLevels).map(([key, level]) => (
              <div
                key={key}
                className={`w-8 h-1.5 rounded-full transition-all duration-300 ${
                  mood.label === level.label ? 'scale-y-150' : 'opacity-40'
                }`}
                style={{ backgroundColor: level.color }}
                title={level.label}
              />
            ))}
          </div>

          {/* Timestamp */}
          <p className="text-text-muted text-xs mt-3">Updated: {new Date().toLocaleTimeString()}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline version for headers/sidebars
 */
export function MarketMoodBadge({
  value = 50,
  className = '',
}: {
  value?: number;
  className?: string;
}) {
  const mood = getMoodLevel(value);

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${className}`}
      style={{ backgroundColor: mood.bgColor }}
    >
      <span className="text-sm">{mood.emoji}</span>
      <span className="text-sm font-semibold" style={{ color: mood.color }}>
        {value}
      </span>
      <span className="text-xs text-text-muted hidden sm:inline">{mood.label}</span>
    </div>
  );
}

/**
 * Mini sparkline version showing mood history
 */
export function MarketMoodSparkline({
  values = [],
  className = '',
}: {
  values?: number[];
  className?: string;
}) {
  if (values.length === 0) return null;

  const width = 100;
  const height = 24;
  const padding = 2;

  const points = values
    .map((v, i) => {
      const x = padding + (i / (values.length - 1)) * (width - padding * 2);
      const y = height - padding - (v / 100) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  const lastValue = values[values.length - 1];
  const mood = getMoodLevel(lastValue);

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke={mood.color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* End dot */}
        <circle
          cx={width - padding}
          cy={height - padding - (lastValue / 100) * (height - padding * 2)}
          r={3}
          fill={mood.color}
        />
      </svg>
      <span className="text-sm font-medium" style={{ color: mood.color }}>
        {lastValue}
      </span>
    </div>
  );
}
