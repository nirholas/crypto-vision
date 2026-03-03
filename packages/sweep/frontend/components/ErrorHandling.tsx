"use client";

import { useCallback, useState } from "react";

interface ErrorDisplayProps {
  error: Error | null;
  title?: string;
  onRetry?: () => void;
  retrying?: boolean;
  variant?: "inline" | "card" | "fullPage" | "toast";
  className?: string;
}

/**
 * Reusable error display component with retry functionality
 */
export function ErrorDisplay({
  error,
  title = "Something went wrong",
  onRetry,
  retrying = false,
  variant = "card",
  className = "",
}: ErrorDisplayProps) {
  if (!error) return null;

  const errorMessage = error.message || "An unexpected error occurred";

  if (variant === "inline") {
    return (
      <div className={`flex items-center gap-2 text-destructive ${className}`}>
        <span className="text-lg">⚠️</span>
        <span className="text-sm">{errorMessage}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={retrying}
            className="text-sm text-primary hover:underline disabled:opacity-50"
          >
            {retrying ? "Retrying..." : "Retry"}
          </button>
        )}
      </div>
    );
  }

  if (variant === "toast") {
    return (
      <div className={`flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg ${className}`}>
        <span className="text-lg flex-shrink-0">❌</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-destructive">{title}</p>
          <p className="text-sm text-muted-foreground mt-1 break-words">{errorMessage}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={retrying}
            className="flex-shrink-0 px-3 py-1 text-sm bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:opacity-50"
          >
            {retrying ? "..." : "Retry"}
          </button>
        )}
      </div>
    );
  }

  if (variant === "fullPage") {
    return (
      <div className={`flex flex-col items-center justify-center min-h-[400px] text-center ${className}`}>
        <div className="text-6xl mb-4">😵</div>
        <h2 className="text-xl font-bold text-destructive mb-2">{title}</h2>
        <p className="text-muted-foreground max-w-md mb-6">{errorMessage}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={retrying}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {retrying ? "Retrying..." : "Try Again"}
          </button>
        )}
      </div>
    );
  }

  // Default card variant
  return (
    <div className={`bg-destructive/5 border border-destructive/20 rounded-xl p-6 ${className}`}>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
          <span className="text-xl">⚠️</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-destructive">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1 break-words">{errorMessage}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              disabled={retrying}
              className="mt-3 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {retrying ? "Retrying..." : "Try Again"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface NetworkErrorProps {
  onRetry?: () => void;
  retrying?: boolean;
}

/**
 * Specialized error display for network failures
 */
export function NetworkError({ onRetry, retrying }: NetworkErrorProps) {
  return (
    <div className="bg-card rounded-xl border p-8 text-center">
      <div className="text-4xl mb-4">🔌</div>
      <h3 className="font-semibold mb-2">Connection Error</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Unable to connect to the server. Please check your internet connection.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={retrying}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {retrying ? "Reconnecting..." : "Retry Connection"}
        </button>
      )}
    </div>
  );
}

interface TransactionErrorProps {
  error: Error;
  hash?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

/**
 * Specialized error display for transaction failures
 */
export function TransactionError({ error, hash, onRetry, retrying }: TransactionErrorProps) {
  const isUserRejected = error.message.toLowerCase().includes("rejected") || 
                         error.message.toLowerCase().includes("denied");
  const isInsufficientFunds = error.message.toLowerCase().includes("insufficient");

  return (
    <div className="bg-card rounded-xl border p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">
            {isUserRejected ? "🚫" : isInsufficientFunds ? "💸" : "❌"}
          </span>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-destructive">
            {isUserRejected 
              ? "Transaction Rejected"
              : isInsufficientFunds 
                ? "Insufficient Funds"
                : "Transaction Failed"
            }
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isUserRejected 
              ? "You rejected the transaction in your wallet."
              : isInsufficientFunds
                ? "You don't have enough funds to complete this transaction."
                : error.message
            }
          </p>
          {hash && (
            <p className="text-xs text-muted-foreground mt-2 font-mono">
              TX: {hash.slice(0, 10)}...{hash.slice(-8)}
            </p>
          )}
          <div className="flex gap-2 mt-4">
            {onRetry && !isUserRejected && (
              <button
                onClick={onRetry}
                disabled={retrying}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {retrying ? "Retrying..." : "Try Again"}
              </button>
            )}
            {isUserRejected && onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-secondary text-secondary-foreground text-sm rounded-lg hover:bg-secondary/80"
              >
                Submit Again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Reusable empty state component
 */
export function EmptyState({ icon = "📭", title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      {description && (
        <p className="text-muted-foreground max-w-sm mx-auto mb-4">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

interface RetryableProps {
  children: React.ReactNode;
  error: Error | null;
  onRetry: () => void;
  retrying?: boolean;
  emptyState?: React.ReactNode;
  isEmpty?: boolean;
}

/**
 * Wrapper component that handles error and empty states
 */
export function Retryable({
  children,
  error,
  onRetry,
  retrying = false,
  emptyState,
  isEmpty = false,
}: RetryableProps) {
  if (error) {
    return <ErrorDisplay error={error} onRetry={onRetry} retrying={retrying} />;
  }

  if (isEmpty && emptyState) {
    return <>{emptyState}</>;
  }

  return <>{children}</>;
}

/**
 * Hook for managing retry state with exponential backoff
 */
export function useRetry(
  fn: () => Promise<void>,
  options: { maxRetries?: number; baseDelay?: number } = {}
) {
  const { maxRetries = 3, baseDelay = 1000 } = options;
  const [retrying, setRetrying] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(async () => {
    if (attempt >= maxRetries) {
      setAttempt(0);
      return;
    }

    setRetrying(true);
    const delay = baseDelay * Math.pow(2, attempt);

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await fn();
      setAttempt(0);
    } catch (err) {
      setAttempt((prev) => prev + 1);
    } finally {
      setRetrying(false);
    }
  }, [fn, attempt, maxRetries, baseDelay]);

  const reset = useCallback(() => {
    setAttempt(0);
    setRetrying(false);
  }, []);

  return {
    retry,
    retrying,
    attempt,
    canRetry: attempt < maxRetries,
    reset,
  };
}

/**
 * Format error messages for display
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Clean up common error messages
    const message = error.message;
    
    if (message.includes("User rejected")) {
      return "Transaction was rejected by user";
    }
    if (message.includes("insufficient funds")) {
      return "Insufficient funds for this transaction";
    }
    if (message.includes("network")) {
      return "Network error. Please check your connection";
    }
    if (message.includes("timeout")) {
      return "Request timed out. Please try again";
    }
    
    return message;
  }
  
  if (typeof error === "string") {
    return error;
  }
  
  return "An unexpected error occurred";
}
