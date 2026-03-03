/**
 * Skeleton Loading Components
 * Reusable loading placeholder components
 */

import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div 
      className={`skeleton ${className}`}
      aria-hidden="true"
    />
  );
}

export function ArticleCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-card p-4 animate-fadeIn">
      <div className="flex gap-4">
        <Skeleton className="w-24 h-24 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-1/2 rounded" />
          <div className="flex items-center gap-2 pt-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-20 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeaturedArticleSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden animate-fadeIn">
      <Skeleton className="w-full h-64" />
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded" />
        </div>
        <Skeleton className="h-7 w-4/5 rounded" />
        <Skeleton className="h-5 w-full rounded" />
        <Skeleton className="h-5 w-3/4 rounded" />
      </div>
    </div>
  );
}

export function MarketStatsSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-card p-6 animate-fadeIn">
      <div className="flex items-center justify-between mb-5">
        <Skeleton className="h-6 w-40 rounded" />
        <Skeleton className="h-5 w-20 rounded" />
      </div>
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-5 w-24 rounded" />
          </div>
        ))}
        <div className="pt-4 border-t border-gray-100">
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function PostsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div 
      className="grid grid-cols-1 md:grid-cols-2 gap-4"
      aria-label="Loading articles..."
      role="status"
    >
      {[...Array(count)].map((_, i) => (
        <ArticleCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PriceTickerSkeleton() {
  return (
    <div className="bg-gray-900 py-2.5 animate-fadeIn">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="w-4 h-4 rounded-full bg-gray-700" />
                <Skeleton className="h-4 w-10 rounded bg-gray-700" />
                <Skeleton className="h-4 w-16 rounded bg-gray-700" />
                <Skeleton className="h-4 w-12 rounded bg-gray-700" />
              </div>
            ))}
          </div>
          <Skeleton className="h-4 w-32 rounded bg-gray-700" />
        </div>
      </div>
    </div>
  );
}
