/**
 * @fileoverview Connection Status Indicator
 *
 * Shows WebSocket connection status with visual feedback.
 * Features:
 * - Connected (green), Connecting (yellow), Offline (red)
 * - Click to manually reconnect
 * - Tooltip with detailed status
 *
 * @module components/ConnectionStatus
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConnectionStatus, type ConnectionStatus as ConnectionStatusType } from '@/hooks/useLivePrice';
import { Wifi, WifiOff, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export interface ConnectionStatusProps {
  /** Display variant */
  variant?: 'dot' | 'badge' | 'full';
  /** Position in layout */
  position?: 'inline' | 'fixed';
  /** Fixed position placement */
  placement?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Whether to show reconnect button */
  showReconnect?: boolean;
  /** Additional className */
  className?: string;
  /** Compact mode for tight spaces */
  compact?: boolean;
}

// =============================================================================
// STATUS CONFIGURATION
// =============================================================================

const STATUS_CONFIG: Record<
  ConnectionStatusType,
  {
    label: string;
    description: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: typeof Wifi;
    animate: boolean;
  }
> = {
  connected: {
    label: 'Live',
    description: 'Real-time prices connected',
    color: 'text-gain',
    bgColor: 'bg-gain/10',
    borderColor: 'border-gain/30',
    icon: Wifi,
    animate: false,
  },
  connecting: {
    label: 'Connecting',
    description: 'Establishing connection...',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/30',
    icon: Loader2,
    animate: true,
  },
  disconnected: {
    label: 'Offline',
    description: 'Click to reconnect',
    color: 'text-text-muted',
    bgColor: 'bg-surface-hover',
    borderColor: 'border-surface-border',
    icon: WifiOff,
    animate: false,
  },
  error: {
    label: 'Error',
    description: 'Connection failed. Click to retry.',
    color: 'text-loss',
    bgColor: 'bg-loss/10',
    borderColor: 'border-loss/30',
    icon: AlertCircle,
    animate: false,
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function ConnectionStatus({
  variant = 'badge',
  position = 'inline',
  placement = 'top-right',
  showReconnect = true,
  className = '',
  compact = false,
}: ConnectionStatusProps) {
  const { status, reconnect } = useConnectionStatus();
  const [isHovered, setIsHovered] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  // Handle reconnect with feedback
  const handleReconnect = useCallback(async () => {
    if (status === 'connecting' || isReconnecting) return;
    
    setIsReconnecting(true);
    reconnect();
    
    // Reset after a short delay
    setTimeout(() => setIsReconnecting(false), 2000);
  }, [status, reconnect, isReconnecting]);

  // Fixed position classes
  const fixedPositionClasses = {
    'top-right': 'fixed top-4 right-4 z-50',
    'top-left': 'fixed top-4 left-4 z-50',
    'bottom-right': 'fixed bottom-4 right-4 z-50',
    'bottom-left': 'fixed bottom-4 left-4 z-50',
  };

  // Dot variant - minimal indicator
  if (variant === 'dot') {
    return (
      <button
        onClick={handleReconnect}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          relative group
          ${position === 'fixed' ? fixedPositionClasses[placement] : ''}
          ${className}
        `}
        title={config.description}
        aria-label={`Connection status: ${config.label}. ${config.description}`}
      >
        <span
          className={`
            connection-status-dot
            ${status === 'connected' ? 'connection-status-dot-connected' : ''}
            ${status === 'connecting' ? 'connection-status-dot-connecting' : ''}
            ${status === 'disconnected' ? 'connection-status-dot-disconnected' : ''}
            ${status === 'error' ? 'connection-status-dot-error' : ''}
          `}
        />
        
        {/* Tooltip on hover */}
        {isHovered && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface-elevated rounded text-xs whitespace-nowrap border border-surface-border shadow-lg">
            {config.label}
          </div>
        )}
      </button>
    );
  }

  // Badge variant - compact with label
  if (variant === 'badge') {
    return (
      <button
        onClick={handleReconnect}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={status === 'connecting'}
        className={`
          inline-flex items-center gap-1.5 px-2 py-1 rounded-full
          text-xs font-medium transition-all duration-200
          ${config.bgColor} ${config.borderColor} ${config.color}
          border hover:opacity-80
          ${position === 'fixed' ? fixedPositionClasses[placement] : ''}
          ${status !== 'connecting' ? 'cursor-pointer' : 'cursor-default'}
          ${className}
        `}
        title={config.description}
        aria-label={`Connection status: ${config.label}. ${config.description}`}
      >
        <Icon
          className={`w-3 h-3 ${config.animate ? 'animate-spin' : ''}`}
        />
        {!compact && <span>{config.label}</span>}
        
        {status === 'connected' && (
          <span className="live-dot-small" aria-hidden="true" />
        )}
      </button>
    );
  }

  // Full variant - detailed with reconnect button
  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        flex items-center gap-3 px-3 py-2 rounded-lg
        ${config.bgColor} ${config.borderColor} ${config.color}
        border transition-all duration-200
        ${position === 'fixed' ? fixedPositionClasses[placement] : ''}
        ${className}
      `}
      role="status"
      aria-label={`Connection status: ${config.label}`}
    >
      {/* Status icon */}
      <div className="flex items-center gap-2">
        <Icon
          className={`w-4 h-4 ${config.animate ? 'animate-spin' : ''}`}
        />
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{config.label}</span>
            {status === 'connected' && (
              <span className="live-dot" aria-hidden="true" />
            )}
          </div>
          <span className="text-xs opacity-70">{config.description}</span>
        </div>
      </div>

      {/* Reconnect button */}
      {showReconnect && status !== 'connected' && status !== 'connecting' && (
        <button
          onClick={handleReconnect}
          disabled={isReconnecting}
          className={`
            p-1.5 rounded-md transition-all duration-200
            hover:bg-surface-hover
            ${isReconnecting ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          aria-label="Reconnect"
        >
          <RefreshCw
            className={`w-4 h-4 ${isReconnecting ? 'animate-spin' : ''}`}
          />
        </button>
      )}
    </div>
  );
}

// =============================================================================
// INLINE STATUS (for GlobalStatsBar)
// =============================================================================

export function InlineConnectionStatus({ className = '' }: { className?: string }) {
  const { status, reconnect } = useConnectionStatus();
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <button
      onClick={() => status !== 'connecting' && reconnect()}
      className={`
        inline-flex items-center gap-1 text-xs
        ${config.color}
        ${status !== 'connecting' ? 'hover:opacity-70 cursor-pointer' : 'cursor-default'}
        transition-opacity
        ${className}
      `}
      title={config.description}
    >
      <Icon className={`w-3 h-3 ${config.animate ? 'animate-spin' : ''}`} />
      {status === 'connected' && <span className="live-dot-small" />}
      <span className="sr-only">{config.description}</span>
    </button>
  );
}

// =============================================================================
// FLOATING STATUS (fixed position)
// =============================================================================

export function FloatingConnectionStatus({
  placement = 'bottom-right',
}: {
  placement?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}) {
  const { status } = useConnectionStatus();
  const [visible, setVisible] = useState(false);

  // Only show when not connected
  useEffect(() => {
    if (status !== 'connected') {
      setVisible(true);
    } else {
      // Hide after short delay when connected
      const timeout = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [status]);

  if (!visible && status === 'connected') return null;

  return (
    <ConnectionStatus
      variant="full"
      position="fixed"
      placement={placement}
      showReconnect
      className={`
        shadow-lg transition-all duration-300
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
    />
  );
}

export default ConnectionStatus;
