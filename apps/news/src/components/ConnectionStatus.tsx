/**
 * Connection Status Component
 * Shows WebSocket connection state with visual indicator and reconnect button
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConnectionState, reconnect } from '@/hooks/useLivePrice';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error' | 'reconnecting';

interface ConnectionStatusProps {
  /** Override connection state (for use with other WebSocket connections) */
  state?: ConnectionState;
  /** Custom reconnect handler */
  onReconnect?: () => void;
  /** Show the component inline or as a floating indicator */
  variant?: 'inline' | 'floating' | 'minimal';
  /** Class name for custom styling */
  className?: string;
  /** Show reconnect button */
  showReconnectButton?: boolean;
  /** Label to display */
  label?: string;
}

const statusConfig: Record<ConnectionState, {
  color: string;
  bgColor: string;
  label: string;
  icon: string;
  pulseColor: string;
}> = {
  connected: {
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    label: 'Connected',
    icon: '●',
    pulseColor: 'bg-green-500',
  },
  connecting: {
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    label: 'Connecting...',
    icon: '◐',
    pulseColor: 'bg-yellow-500',
  },
  disconnected: {
    color: 'text-gray-500 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    label: 'Disconnected',
    icon: '○',
    pulseColor: 'bg-gray-400',
  },
  error: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    label: 'Connection Error',
    icon: '✕',
    pulseColor: 'bg-red-500',
  },
  reconnecting: {
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    label: 'Reconnecting...',
    icon: '◐',
    pulseColor: 'bg-yellow-500',
  },
};

/**
 * Minimal dot indicator
 */
function MinimalIndicator({ state }: { state: ConnectionState }) {
  const config = statusConfig[state];
  
  return (
    <span 
      className={`inline-block w-2 h-2 rounded-full ${config.pulseColor} ${
        state === 'connected' ? 'live-dot' : ''
      } ${state === 'connecting' || state === 'reconnecting' ? 'animate-pulse' : ''}`}
      title={config.label}
      aria-label={config.label}
    />
  );
}

/**
 * Inline status indicator
 */
function InlineIndicator({ 
  state, 
  label,
  showReconnectButton,
  onReconnect 
}: { 
  state: ConnectionState;
  label?: string;
  showReconnectButton: boolean;
  onReconnect: () => void;
}) {
  const config = statusConfig[state];
  
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${config.bgColor}`}>
      <span className={`${state === 'connected' ? 'live-dot' : ''} ${state === 'connecting' || state === 'reconnecting' ? 'animate-spin' : ''}`}>
        {config.icon}
      </span>
      <span className={config.color}>
        {label || config.label}
      </span>
      {showReconnectButton && (state === 'disconnected' || state === 'error') && (
        <button
          onClick={onReconnect}
          className="ml-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
          aria-label="Reconnect"
        >
          Reconnect
        </button>
      )}
    </div>
  );
}

/**
 * Floating status indicator (fixed position)
 */
function FloatingIndicator({ 
  state, 
  label,
  showReconnectButton,
  onReconnect 
}: { 
  state: ConnectionState;
  label?: string;
  showReconnectButton: boolean;
  onReconnect: () => void;
}) {
  const config = statusConfig[state];
  const [isVisible, setIsVisible] = useState(true);
  
  // Auto-hide when connected after a delay
  useEffect(() => {
    if (state === 'connected') {
      const timer = setTimeout(() => setIsVisible(false), 3000);
      return () => clearTimeout(timer);
    }
    setIsVisible(true);
  }, [state]);
  
  if (!isVisible && state === 'connected') {
    return null;
  }
  
  return (
    <div 
      className={`
        fixed bottom-4 right-4 z-50 
        flex items-center gap-3 px-4 py-2 
        rounded-lg shadow-lg border
        ${config.bgColor}
        border-gray-200 dark:border-gray-700
        transition-all duration-300
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
      role="status"
      aria-live="polite"
    >
      <span 
        className={`
          inline-flex items-center justify-center w-6 h-6 rounded-full
          ${config.pulseColor}
          ${state === 'connected' ? 'live-dot' : ''}
          ${state === 'connecting' || state === 'reconnecting' ? 'animate-pulse' : ''}
        `}
      >
        <span className="text-white text-xs">{config.icon}</span>
      </span>
      
      <div className="flex flex-col">
        <span className={`font-medium text-sm ${config.color}`}>
          {label || config.label}
        </span>
        {(state === 'connecting' || state === 'reconnecting') && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {state === 'reconnecting' ? 'Reconnecting...' : 'Establishing connection...'}
          </span>
        )}
      </div>
      
      {showReconnectButton && (state === 'disconnected' || state === 'error') && (
        <button
          onClick={onReconnect}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
          aria-label="Reconnect to server"
        >
          Reconnect
        </button>
      )}
      
      {state === 'connected' && (
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/**
 * Main ConnectionStatus component
 */
export function ConnectionStatus({
  state: externalState,
  onReconnect: externalReconnect,
  variant = 'inline',
  className = '',
  showReconnectButton = true,
  label,
}: ConnectionStatusProps) {
  // Use internal hook state if no external state provided
  const internalState = useConnectionState();
  const state = externalState || internalState;
  
  const handleReconnect = useCallback(() => {
    if (externalReconnect) {
      externalReconnect();
    } else {
      reconnect();
    }
  }, [externalReconnect]);
  
  const commonProps = {
    state,
    label,
    showReconnectButton,
    onReconnect: handleReconnect,
  };
  
  if (variant === 'minimal') {
    return (
      <div className={className}>
        <MinimalIndicator state={state} />
      </div>
    );
  }
  
  if (variant === 'floating') {
    return <FloatingIndicator {...commonProps} />;
  }
  
  return (
    <div className={className}>
      <InlineIndicator {...commonProps} />
    </div>
  );
}

/**
 * Hook to use connection status programmatically
 */
export function useConnectionStatus(externalState?: ConnectionState) {
  const internalState = useConnectionState();
  const state = externalState || internalState;
  
  return {
    state,
    isConnected: state === 'connected',
    isConnecting: state === 'connecting',
    isReconnecting: state === 'reconnecting',
    isDisconnected: state === 'disconnected',
    hasError: state === 'error',
    reconnect,
    statusConfig: statusConfig[state],
  };
}

export default ConnectionStatus;
