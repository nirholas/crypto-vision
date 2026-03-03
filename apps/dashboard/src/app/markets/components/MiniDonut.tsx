'use client';

/**
 * Mini Donut Chart Component
 * A tiny SVG donut chart for displaying dominance percentages
 */

interface MiniDonutProps {
  /** Percentage value (0-100) */
  value: number;
  /** Color of the filled portion */
  color?: string;
  /** Size in pixels */
  size?: number;
  /** Stroke width */
  strokeWidth?: number;
  /** Optional label inside */
  showLabel?: boolean;
}

export default function MiniDonut({
  value,
  color = 'var(--brand)',
  size = 20,
  strokeWidth = 3,
  showLabel = false,
}: MiniDonutProps) {
  // Clamp value between 0 and 100
  const clampedValue = Math.max(0, Math.min(100, value));
  
  // Calculate SVG parameters
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;
  const center = size / 2;

  return (
    <div 
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--surface-border)"
          strokeWidth={strokeWidth}
        />
        
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      
      {showLabel && size >= 32 && (
        <span 
          className="absolute text-[8px] font-bold text-text-primary"
          style={{ fontSize: Math.max(8, size / 4) }}
        >
          {Math.round(clampedValue)}
        </span>
      )}
    </div>
  );
}
