'use client';

/* ─── Types ──────────────────────────────────────────────────────────── */

type StatusType = 'connected' | 'connecting' | 'disconnected' | 'error' | 'warning';
type DotSize = 'xs' | 'sm' | 'md' | 'lg';

export interface StatusDotProps {
  status: StatusType;
  size?: DotSize;
  label?: string;
  showLabel?: boolean;
  className?: string;
}

/* ─── Color / Size Maps ──────────────────────────────────────────────── */

const STATUS_COLORS: Record<StatusType, { bg: string; ring: string; text: string }> = {
  connected: {
    bg: 'bg-[var(--gain)]',
    ring: 'rgba(0, 214, 143, 0.5)',
    text: 'text-[var(--gain)]',
  },
  connecting: {
    bg: 'bg-[var(--warning)]',
    ring: 'rgba(255, 170, 0, 0.5)',
    text: 'text-[var(--warning)]',
  },
  disconnected: {
    bg: 'bg-[var(--text-muted)]',
    ring: 'transparent',
    text: 'text-[var(--text-muted)]',
  },
  error: {
    bg: 'bg-[var(--loss)]',
    ring: 'rgba(255, 61, 113, 0.5)',
    text: 'text-[var(--loss)]',
  },
  warning: {
    bg: 'bg-[var(--warning)]',
    ring: 'rgba(255, 170, 0, 0.5)',
    text: 'text-[var(--warning)]',
  },
};

const SIZE_MAP: Record<DotSize, { dot: string; outer: string; px: number }> = {
  xs: { dot: 'w-1.5 h-1.5', outer: 'w-3 h-3', px: 6 },
  sm: { dot: 'w-2 h-2', outer: 'w-4 h-4', px: 8 },
  md: { dot: 'w-2.5 h-2.5', outer: 'w-5 h-5', px: 10 },
  lg: { dot: 'w-3 h-3', outer: 'w-6 h-6', px: 12 },
};

const STATUS_LABELS: Record<StatusType, string> = {
  connected: 'Connected',
  connecting: 'Connecting...',
  disconnected: 'Disconnected',
  error: 'Connection Error',
  warning: 'Unstable Connection',
};

/* ─── Component ──────────────────────────────────────────────────────── */

export function StatusDot({
  status,
  size = 'md',
  label,
  showLabel = false,
  className = '',
}: StatusDotProps) {
  const colors = STATUS_COLORS[status];
  const sizes = SIZE_MAP[size];
  const displayLabel = label ?? STATUS_LABELS[status];
  const isPulsing = status === 'connected' || status === 'error';
  const isBlinking = status === 'connecting' || status === 'warning';

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      role="status"
      aria-label={displayLabel}
    >
      <span className="relative inline-flex">
        {/* Pulse ring */}
        {isPulsing && (
          <span
            className={`absolute inset-0 rounded-full ${colors.bg} opacity-50 animate-ping`}
            style={{ animationDuration: '2s' }}
          />
        )}
        {/* Blink */}
        {isBlinking && (
          <span
            className={`absolute inset-0 rounded-full ${colors.bg} opacity-40`}
            style={{ animation: 'connection-blink 1s ease-in-out infinite' }}
          />
        )}
        {/* Core dot */}
        <span
          className={`relative inline-block rounded-full ${colors.bg} ${sizes.dot}`}
          style={{
            boxShadow: `0 0 ${sizes.px}px ${colors.ring}`,
          }}
        />
      </span>
      {showLabel && (
        <span className={`text-xs font-medium ${colors.text}`}>
          {displayLabel}
        </span>
      )}
    </span>
  );
}

export default StatusDot;
