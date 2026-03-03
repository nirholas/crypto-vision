'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';

type EmptyStateVariant = 'default' | 'search' | 'bookmarks' | 'error' | 'offline' | 'loading';

interface EmptyStateProps {
  /** Variant determines the icon and default text */
  variant?: EmptyStateVariant;
  /** Custom title */
  title?: string;
  /** Custom description */
  description?: string;
  /** Custom icon (emoji or ReactNode) */
  icon?: ReactNode;
  /** Primary action button */
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /** Secondary action */
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /** Additional CSS classes */
  className?: string;
  /** Compact mode for smaller spaces */
  compact?: boolean;
}

const variantConfig: Record<
  EmptyStateVariant,
  { icon: string; title: string; description: string }
> = {
  default: {
    icon: 'EMPTY',
    title: 'No content yet',
    description: "There's nothing to show here at the moment.",
  },
  search: {
    icon: 'SEARCH',
    title: 'No results found',
    description: 'Try adjusting your search terms or filters.',
  },
  bookmarks: {
    icon: 'SAVED',
    title: 'No bookmarks yet',
    description: 'Save articles to read later by clicking the bookmark icon.',
  },
  error: {
    icon: 'ERROR',
    title: 'Something went wrong',
    description: "We couldn't load this content. Please try again.",
  },
  offline: {
    icon: 'OFFLINE',
    title: "You're offline",
    description: 'Check your internet connection and try again.',
  },
  loading: {
    icon: 'LOADING',
    title: 'Loading...',
    description: 'Please wait while we fetch the content.',
  },
};

export function EmptyState({
  variant = 'default',
  title,
  description,
  icon,
  action,
  secondaryAction,
  className = '',
  compact = false,
}: EmptyStateProps) {
  const config = variantConfig[variant];

  const displayIcon = icon ?? config.icon;
  const displayTitle = title ?? config.title;
  const displayDescription = description ?? config.description;

  const ActionButton = ({
    action: act,
    primary = false,
  }: {
    action: NonNullable<EmptyStateProps['action']>;
    primary?: boolean;
  }) => {
    const baseClasses = primary
      ? 'px-4 py-2 bg-primary text-white font-medium rounded-lg transition-colors hover:bg-primary-hover'
      : 'px-4 py-2 bg-surface hover:bg-surface-hover text-text-secondary font-medium rounded-lg transition-colors';

    if (act.href) {
      return (
        <Link href={act.href} className={baseClasses}>
          {act.label}
        </Link>
      );
    }

    return (
      <button onClick={act.onClick} className={baseClasses}>
        {act.label}
      </button>
    );
  };

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8' : 'py-16'} ${className}`}
    >
      {/* Icon */}
      <div className={`${compact ? 'text-4xl mb-3' : 'text-6xl mb-4'}`}>
        {typeof displayIcon === 'string' ? (
          <span role="img" aria-hidden="true">
            {displayIcon}
          </span>
        ) : (
          displayIcon
        )}
      </div>

      {/* Title */}
      <h3
        className={`font-semibold text-text-primary ${compact ? 'text-lg mb-1' : 'text-xl mb-2'}`}
      >
        {displayTitle}
      </h3>

      {/* Description */}
      <p className={`text-text-muted max-w-sm ${compact ? 'text-sm mb-4' : 'text-base mb-6'}`}>
        {displayDescription}
      </p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action && <ActionButton action={action} primary />}
          {secondaryAction && <ActionButton action={secondaryAction} />}
        </div>
      )}
    </div>
  );
}

// Specialized variants for common use cases
export function SearchEmptyState({ query, onClear }: { query?: string; onClear?: () => void }) {
  return (
    <EmptyState
      variant="search"
      title={query ? `No results for "${query}"` : 'No results found'}
      description="Try different keywords or remove some filters."
      action={onClear ? { label: 'Clear search', onClick: onClear } : undefined}
      secondaryAction={{ label: 'Browse all news', href: '/' }}
    />
  );
}

export function BookmarksEmptyState() {
  return (
    <EmptyState variant="bookmarks" action={{ label: 'Explore trending', href: '/trending' }} />
  );
}

export function OfflineEmptyState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      variant="offline"
      action={onRetry ? { label: 'Try again', onClick: onRetry } : undefined}
    />
  );
}

export function ErrorEmptyState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      variant="error"
      action={onRetry ? { label: 'Try again', onClick: onRetry } : undefined}
      secondaryAction={{ label: 'Go home', href: '/' }}
    />
  );
}

export function LoadingState({ message }: { message?: string }) {
  return (
    <EmptyState
      variant="loading"
      description={message}
      icon={
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
      }
    />
  );
}

export default EmptyState;
