/**
 * ErrorBoundary Component
 * 
 * Error boundary for graceful error handling with retry
 */

'use client';

import React, { Component, memo } from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('RAG Chat Error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <ErrorFallback 
          error={this.state.error} 
          onReset={this.handleReset} 
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default error fallback UI
 */
interface ErrorFallbackProps {
  error: Error | null;
  onReset?: () => void;
}

function ErrorFallbackComponent({ error, onReset }: ErrorFallbackProps) {
  return (
    <div className="flex items-center justify-center min-h-[200px] p-6">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full 
                        bg-red-500/20 mb-4">
          <svg
            className="w-8 h-8 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        
        <h3 className="text-lg font-semibold text-gray-100 mb-2">
          Something went wrong
        </h3>
        
        <p className="text-sm text-gray-400 mb-4">
          {error?.message || 'An unexpected error occurred. Please try again.'}
        </p>
        
        {onReset && (
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500
                       text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}

export const ErrorFallback = memo(ErrorFallbackComponent);

/**
 * Message-level error display with retry
 */
interface MessageErrorProps {
  error: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

function MessageErrorComponent({ error, onRetry, isRetrying = false }: MessageErrorProps) {
  return (
    <div className="flex gap-4">
      {/* Error icon */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-600/30 flex items-center justify-center">
        <svg
          className="w-4 h-4 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      {/* Error content */}
      <div className="flex-1 max-w-[85%]">
        <div className="p-4 rounded-2xl rounded-bl-md bg-red-900/20 border border-red-500/30">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-red-300 mb-1">
                Failed to get response
              </p>
              <p className="text-sm text-red-400/80">
                {error}
              </p>
            </div>
            
            {onRetry && (
              <button
                onClick={onRetry}
                disabled={isRetrying}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5
                           bg-red-600/30 hover:bg-red-600/50 disabled:bg-red-600/20
                           text-red-300 text-xs font-medium rounded-lg transition-colors
                           disabled:cursor-not-allowed"
                aria-label="Retry request"
              >
                {isRetrying ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Retrying...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Retry
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        
        {/* Troubleshooting tips */}
        <div className="mt-2 text-xs text-gray-500">
          <span className="font-medium">Tip:</span> Check your connection or try rephrasing your question.
        </div>
      </div>
    </div>
  );
}

export const MessageError = memo(MessageErrorComponent);

/**
 * Network error banner
 */
interface NetworkErrorBannerProps {
  isOffline?: boolean;
  onRetryConnection?: () => void;
}

function NetworkErrorBannerComponent({ isOffline = false, onRetryConnection }: NetworkErrorBannerProps) {
  if (!isOffline) return null;

  return (
    <div className="p-3 bg-yellow-900/30 border-b border-yellow-500/30 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <svg
          className="w-4 h-4 text-yellow-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
          />
        </svg>
        <span className="text-sm text-yellow-300">
          You appear to be offline. Responses may be delayed.
        </span>
      </div>
      
      {onRetryConnection && (
        <button
          onClick={onRetryConnection}
          className="text-xs text-yellow-400 hover:text-yellow-300 underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export const NetworkErrorBanner = memo(NetworkErrorBannerComponent);

export default ErrorBoundary;
