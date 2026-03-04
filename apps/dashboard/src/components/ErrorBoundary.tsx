'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback component */
  fallback?: ReactNode;
  /** Callback when error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Show reset button */
  showReset?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          onReset={this.props.showReset !== false ? this.handleReset : undefined}
        />
      );
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error | null;
  onReset?: () => void;
}

function DefaultErrorFallback({ error, onReset }: DefaultErrorFallbackProps) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Error icon */}
        <div
          className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
          style={{ background: 'var(--loss-bg)' }}
        >
          <AlertTriangle className="w-8 h-8" style={{ color: 'var(--loss)' }} />
        </div>

        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Something went wrong
        </h2>

        <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
          We encountered an unexpected error. Please try again or return to the homepage.
        </p>

        {/* Error details (development only) */}
        {process.env.NODE_ENV === 'development' && error && (
          <details className="mb-6 text-left">
            <summary
              className="cursor-pointer text-sm hover:opacity-80 transition-opacity"
              style={{ color: 'var(--text-muted)' }}
            >
              Error details
            </summary>
            <pre
              className="mt-2 p-3 rounded-lg text-xs overflow-auto max-h-40"
              style={{ background: 'var(--surface)', color: 'var(--loss)' }}
            >
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          {onReset && (
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2"
              style={{
                background: 'var(--primary)',
                color: 'var(--bg-primary)',
              }}
            >
              <RotateCcw className="w-4 h-4" />
              Try again
            </button>
          )}
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--surface-border)',
            }}
          >
            <Home className="w-4 h-4" />
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Standalone ErrorFallback component for use outside ErrorBoundary
 * Used by Next.js error.tsx and global-error.tsx
 */
export interface ErrorFallbackProps {
  error: Error | null;
  onRetry?: () => void;
  title?: string;
  description?: string;
}

export function ErrorFallback({
  error,
  onRetry,
  title = 'Something went wrong',
  description = 'We encountered an unexpected error. Please try again or return to the homepage.',
}: ErrorFallbackProps) {
  return (
    <div className="max-w-md w-full text-center animate-fade-in">
      {/* Error icon */}
      <div
        className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
        style={{ background: 'var(--loss-bg)' }}
      >
        <AlertTriangle className="w-8 h-8" style={{ color: 'var(--loss)' }} />
      </div>

      <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h2>

      <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
        {description}
      </p>

      {/* Error details (development only) */}
      {process.env.NODE_ENV === 'development' && error && (
        <details className="mb-6 text-left">
          <summary
            className="cursor-pointer text-sm hover:opacity-80 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            Error details
          </summary>
          <pre
            className="mt-2 p-3 rounded-lg text-xs overflow-auto max-h-40"
            style={{ background: 'var(--surface)', color: 'var(--loss)' }}
          >
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        </details>
      )}

      {/* Actions */}
      <div className="flex items-center justify-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2"
            style={{
              background: 'var(--primary)',
              color: 'var(--bg-primary)',
            }}
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </button>
        )}
        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: 'var(--surface)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--surface-border)',
          }}
        >
          <Home className="w-4 h-4" />
          Go home
        </Link>
      </div>
    </div>
  );
}

// Higher-order component version
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;
